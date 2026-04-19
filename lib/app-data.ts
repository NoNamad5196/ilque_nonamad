import { getApiActor, getServerAuthSession, getViewer } from "@/lib/auth";
import { generateGoalPlanWithAi, generateQuestPlanWithAi } from "@/lib/ai/gemma";
import { getCurrentWeekMission, getTodayCalendarEvents } from "@/lib/calendar";
import { has } from "@/lib/env";
import { createMockGoalPlan, createMockWeekProgress } from "@/lib/mock-data";
import { completeQuestLocally } from "@/lib/quests";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  type DashboardSnapshot,
  type GoalInput,
  type GoalPlan,
  type HistoryEntry,
  type Quest,
  type UserStats
} from "@/lib/types";

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const viewer = await getViewer();
  const session = await getServerAuthSession();

  if (!session?.user || !session.accessToken) {
    return createSignedInEmptyDashboardSnapshot(viewer);
  }

  try {
    const [todayEvents, weeklyMission, stats, weekProgress] = await Promise.all([
      getTodayCalendarEvents(session.accessToken),
      getCurrentWeekMission(session.accessToken),
      getUserStats(session.user.id),
      getWeeklyProgress(session.user.id)
    ]);

    const quests = await generateQuestPlanWithAi({
      todayEvents,
      weeklyMission
    });

    const onboardingState =
      todayEvents.length === 0 && !weeklyMission
        ? "needs_setup"
        : todayEvents.length === 0
          ? "manual_only"
          : "ready";

    return {
      viewer,
      stats,
      weekProgress,
      weeklyMission,
      quests,
      onboardingState,
      config: {
        authConfigured: has.auth,
        supabaseConfigured: has.supabase,
        aiConfigured: has.ai,
        calendarConnected: true
      }
    };
  } catch {
    return createSignedInEmptyDashboardSnapshot(viewer);
  }
}

export async function getUserStats(userId?: string): Promise<UserStats> {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !userId) {
    return createEmptyStats();
  }

  const { data } = await supabase
    .from("users")
    .select("xp, level, streak, last_completed_date")
    .eq("id", userId)
    .maybeSingle();

  if (!data) {
    return createEmptyStats();
  }

  return {
    xp: data.xp ?? 0,
    level: data.level ?? 1,
    streak: data.streak ?? 0,
    lastCompletedDate: data.last_completed_date
  };
}

export async function getWeeklyProgress(userId?: string) {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !userId) {
    return createEmptyWeekProgress();
  }

  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const { data } = await supabase
    .from("weekly_progress")
    .select("week_date, completed")
    .gte("week_date", monday.toISOString().slice(0, 10))
    .lt("week_date", sunday.toISOString().slice(0, 10))
    .eq("user_id", userId);

  if (!data || data.length === 0) {
    return createEmptyWeekProgress();
  }

  const progressMap = new Map(data.map((item) => [item.week_date, item.completed]));

  return createMockWeekProgress().map((dayItem) => ({
    ...dayItem,
    completed: progressMap.get(dayItem.date) ?? false
  }));
}

export async function getHistoryEntries(userId?: string): Promise<HistoryEntry[]> {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !userId) {
    return [];
  }

  const { data } = await supabase
    .from("quest_completions")
    .select("id, quest_title, category, xp_earned, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(20);

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    questTitle: entry.quest_title,
    category: entry.category,
    xpEarned: entry.xp_earned,
    completedAt: entry.completed_at
  }));
}

export async function completeQuestForActor(quest: Quest) {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const currentStats = await getUserStats(actor.viewer.id);
  const nextStats = completeQuestLocally(currentStats, quest);
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return nextStats;
  }

  await supabase.from("quest_completions").insert({
    user_id: actor.viewer.id,
    quest_title: quest.title,
    category: quest.category,
    xp_earned: quest.xp,
    completed_at: new Date().toISOString()
  });

  await supabase
    .from("users")
    .update({
      xp: nextStats.xp,
      level: nextStats.level,
      streak: nextStats.streak,
      last_completed_date: nextStats.lastCompletedDate
    })
    .eq("id", actor.viewer.id);

  return nextStats;
}

export async function generateGoalPlan(input: GoalInput, persist = false): Promise<GoalPlan> {
  const actor = await getApiActor();
  const plan = has.ai ? await generateGoalPlanWithAi(input) : createMockGoalPlan(input);

  if (!persist || !actor) {
    return plan;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return plan;
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + input.durationDays);

  await supabase.from("user_goals").insert({
    user_id: actor.viewer.id,
    title: input.title,
    category: input.category,
    start_date: today.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
    daily_hours: parseFloat(input.dailyHours) || 2,
    level: input.currentLevel,
    plan_json: plan,
    is_active: true
  });

  return plan;
}

function createEmptyStats(): UserStats {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastCompletedDate: null
  };
}

function createEmptyWeekProgress() {
  return createMockWeekProgress().map((dayItem) => ({
    ...dayItem,
    completed: false
  }));
}

function createSignedInEmptyDashboardSnapshot(viewer: DashboardSnapshot["viewer"]): DashboardSnapshot {
  return {
    viewer,
    stats: createEmptyStats(),
    weekProgress: createEmptyWeekProgress(),
    weeklyMission: null,
    quests: [],
    onboardingState: "needs_setup",
    config: {
      authConfigured: has.auth,
      supabaseConfigured: has.supabase,
      aiConfigured: has.ai,
      calendarConnected: false
    }
  };
}
