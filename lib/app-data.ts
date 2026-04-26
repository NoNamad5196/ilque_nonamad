import { getApiActor, getServerAuthSession, getViewer } from "@/lib/auth";
import { generateGoalPlanWithAi, generateQuestPlanWithAi, refineGoalPlanWithAi } from "@/lib/ai/gemini";
import { getCurrentWeekMission, getTodayCalendarEvents } from "@/lib/calendar";
import { has } from "@/lib/env";
import { createManualQuestPreview, createMockGoalPlan, createMockWeekProgress } from "@/lib/mock-data";
import {
  archiveNotionGoal,
  archiveNotionQuestBySupabaseId,
  recordGoalPlanToNotion,
  recordManualQuestToNotion,
  recordQuestCompletionToNotion,
  undoNotionQuestCompletion
} from "@/lib/notion/records";
import { completeQuestLocally } from "@/lib/quests";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  type DashboardSnapshot,
  type GoalInput,
  type GoalPlan,
  type HistoryEntry,
  type Quest,
  type QuestCategory,
  type SavedGoal,
  type UserStats
} from "@/lib/types";
import { QUEST_XP, getLevelFromXp, guessCategoryFromText, toIsoDate } from "@/lib/utils";

type ManualQuestRow = {
  id: string;
  title: string;
  description: string | null;
  category: QuestCategory;
  start_time: string;
  end_time: string;
  xp: number;
  completed: boolean;
};

type CompletionRow = {
  xp_earned: number;
  completed_at: string;
};

type GoalRow = {
  id: string;
  title: string;
  category: string;
  start_date: string;
  end_date: string;
  daily_hours: number | string;
  level: string;
  plan_json: unknown;
  created_at: string;
};

export type QuestCompletionResult = {
  stats: UserStats;
  completionId?: string;
  notionPageId?: string;
};

const manualQuestSelect = "id, title, description, category, start_time, end_time, xp, completed";
const goalSelect =
  "id, title, category, start_date, end_date, daily_hours, level, plan_json, created_at";

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const viewer = await getViewer();
  const session = await getServerAuthSession();

  if (!session?.user) {
    return createSignedInEmptyDashboardSnapshot(viewer);
  }

  try {
    const [stats, weekProgress, manualQuests] = await Promise.all([
      getUserStats(session.user.id),
      getWeeklyProgress(session.user.id),
      getPendingManualQuests(session.user.id)
    ]);

    let todayEvents: Awaited<ReturnType<typeof getTodayCalendarEvents>> = [];
    let weeklyMission: Awaited<ReturnType<typeof getCurrentWeekMission>> = null;
    let calendarConnected = false;

    if (session.accessToken) {
      try {
        [todayEvents, weeklyMission] = await Promise.all([
          getTodayCalendarEvents(session.accessToken),
          getCurrentWeekMission(session.accessToken)
        ]);
        calendarConnected = true;
      } catch {
        calendarConnected = false;
      }
    }

    const generatedQuests = calendarConnected
      ? await generateQuestPlanWithAi({
          todayEvents,
          weeklyMission
        }).catch(() => [])
      : [];

    const quests = [...manualQuests, ...generatedQuests];
    const onboardingState =
      quests.length > 0
        ? "ready"
        : todayEvents.length === 0 && !weeklyMission
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
        calendarConnected
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

export async function getPendingManualQuests(userId?: string): Promise<Quest[]> {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("manual_quests")
    .select(manualQuestSelect)
    .eq("user_id", userId)
    .eq("completed", false)
    .order("created_at", { ascending: true })
    .limit(30);

  if (error || !data) {
    return [];
  }

  return data.map(mapManualQuestRow);
}

export async function createManualQuestForActor(input: {
  title: string;
  description?: string;
  category?: QuestCategory;
}): Promise<Quest | null> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const category = input.category ?? guessCategoryFromText(input.title);
  const preview = createManualQuestPreview(input.title);
  const description = input.description?.trim() || preview.description;

  const { data, error } = await supabase
    .from("manual_quests")
    .insert({
      user_id: actor.viewer.id,
      title: input.title,
      description,
      category,
      start_time: preview.startTime,
      end_time: preview.endTime,
      xp: QUEST_XP[category],
      completed: false
    })
    .select(manualQuestSelect)
    .single();

  if (error || !data) {
    throw new Error("Manual quest insert failed.");
  }

  const quest = mapManualQuestRow(data);

  await recordManualQuestToNotion({
    quest,
    userId: actor.viewer.id
  }).catch(() => undefined);

  return quest;
}

export async function deleteManualQuestForActor(id: string): Promise<boolean | null> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error: selectError } = await supabase
    .from("manual_quests")
    .select("id")
    .eq("id", id)
    .eq("user_id", actor.viewer.id)
    .maybeSingle();

  if (selectError) {
    throw new Error("Manual quest lookup failed.");
  }

  if (!data) {
    return false;
  }

  const { error: deleteError } = await supabase
    .from("manual_quests")
    .delete()
    .eq("id", id)
    .eq("user_id", actor.viewer.id);

  if (deleteError) {
    throw new Error("Manual quest delete failed.");
  }

  await archiveNotionQuestBySupabaseId(id).catch(() => undefined);

  return true;
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

export async function getSavedGoals(userId?: string): Promise<SavedGoal[]> {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_goals")
    .select(goalSelect)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapGoalRow(row as GoalRow));
}

export async function completeQuestForActor(quest: Quest): Promise<QuestCompletionResult | null> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const currentStats = await getUserStats(actor.viewer.id);
  const nextStats = completeQuestLocally(currentStats, quest);
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return { stats: nextStats };
  }

  const completedAt = new Date().toISOString();
  const { data: completion, error: completionError } = await supabase
    .from("quest_completions")
    .insert({
      user_id: actor.viewer.id,
      quest_title: quest.title,
      category: quest.category,
      xp_earned: quest.xp,
      completed_at: completedAt
    })
    .select("id")
    .single();

  if (completionError || !completion) {
    throw new Error("Quest completion insert failed.");
  }

  if (quest.source === "manual") {
    const { error: manualUpdateError } = await supabase
      .from("manual_quests")
      .update({ completed: true })
      .eq("id", quest.id)
      .eq("user_id", actor.viewer.id);

    if (manualUpdateError) {
      throw new Error("Manual quest update failed.");
    }
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update({
      xp: nextStats.xp,
      level: nextStats.level,
      streak: nextStats.streak,
      last_completed_date: nextStats.lastCompletedDate
    })
    .eq("id", actor.viewer.id);

  if (userUpdateError) {
    throw new Error("User stats update failed.");
  }

  const notionPageId = await recordQuestCompletionToNotion({
    quest,
    completionId: completion.id,
    userId: actor.viewer.id,
    completedAt
  }).catch(() => undefined);

  return {
    stats: nextStats,
    completionId: completion.id,
    notionPageId
  };
}

export async function undoQuestCompletionForActor(input: {
  completionId: string;
  notionPageId?: string;
  quest: Quest;
}): Promise<UserStats | null> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: completion, error: selectError } = await supabase
    .from("quest_completions")
    .select("id")
    .eq("id", input.completionId)
    .eq("user_id", actor.viewer.id)
    .maybeSingle();

  if (selectError) {
    throw new Error("Quest completion lookup failed.");
  }

  if (!completion) {
    return getUserStats(actor.viewer.id);
  }

  const { error: deleteError } = await supabase
    .from("quest_completions")
    .delete()
    .eq("id", input.completionId)
    .eq("user_id", actor.viewer.id);

  if (deleteError) {
    throw new Error("Quest completion delete failed.");
  }

  if (input.quest.source === "manual") {
    const { error: manualUpdateError } = await supabase
      .from("manual_quests")
      .update({ completed: false })
      .eq("id", input.quest.id)
      .eq("user_id", actor.viewer.id);

    if (manualUpdateError) {
      throw new Error("Manual quest undo failed.");
    }
  }

  await undoNotionQuestCompletion({
    quest: input.quest,
    notionPageId: input.notionPageId
  }).catch(() => undefined);

  return rebuildUserStatsFromCompletions(actor.viewer.id);
}

export async function generateGoalPlan(
  input: GoalInput,
  persist = false,
  planOverride?: GoalPlan
): Promise<{
  plan: GoalPlan;
  savedGoal?: SavedGoal;
}> {
  const actor = await getApiActor();
  const plan = planOverride ?? (has.ai ? await generateGoalPlanWithAi(input) : createMockGoalPlan(input));

  if (!persist || !actor) {
    return { plan };
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return { plan };
  }

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + input.durationDays);

  const { data, error } = await supabase
    .from("user_goals")
    .insert({
      user_id: actor.viewer.id,
      title: input.title,
      category: input.category,
      start_date: today.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      daily_hours: parseFloat(input.dailyHours) || 2,
      level: input.currentLevel,
      plan_json: plan,
      is_active: true
    })
    .select(goalSelect)
    .single();

  if (error || !data) {
    throw new Error("Goal insert failed.");
  }

  const savedGoal = mapGoalRow(data as GoalRow);

  await recordGoalPlanToNotion({
    goal: input,
    plan,
    userId: actor.viewer.id,
    goalId: savedGoal.id
  }).catch(() => undefined);

  return {
    plan,
    savedGoal
  };
}

export async function updateGoalForActor(
  id: string,
  input: GoalInput,
  planOverride?: GoalPlan
): Promise<SavedGoal | null | false> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existingGoal, error: selectError } = await supabase
    .from("user_goals")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", actor.viewer.id)
    .maybeSingle();

  if (selectError) {
    throw new Error("Goal lookup failed.");
  }

  if (!existingGoal) {
    return false;
  }

  const plan = planOverride ?? (has.ai ? await generateGoalPlanWithAi(input) : createMockGoalPlan(input));
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + input.durationDays);

  const { data, error } = await supabase
    .from("user_goals")
    .update({
      title: input.title,
      category: input.category,
      start_date: today.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      daily_hours: parseFloat(input.dailyHours) || 2,
      level: input.currentLevel,
      plan_json: plan,
      is_active: true
    })
    .eq("id", id)
    .eq("user_id", actor.viewer.id)
    .select(goalSelect)
    .single();

  if (error || !data) {
    throw new Error("Goal update failed.");
  }

  const savedGoal = mapGoalRow(data as GoalRow);

  await recordGoalPlanToNotion({
    goal: input,
    plan,
    userId: actor.viewer.id,
    goalId: savedGoal.id,
    previousTitle: existingGoal.title
  }).catch(() => undefined);

  return savedGoal;
}

export async function refineGoalPlan(input: {
  goal: GoalInput;
  plan: GoalPlan;
  instruction: string;
}) {
  return refineGoalPlanWithAi(input);
}

export async function deleteGoalForActor(id: string): Promise<boolean | null> {
  const actor = await getApiActor();

  if (!actor) {
    return null;
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error: selectError } = await supabase
    .from("user_goals")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", actor.viewer.id)
    .maybeSingle();

  if (selectError) {
    throw new Error("Goal lookup failed.");
  }

  if (!data) {
    return false;
  }

  const { error: deleteError } = await supabase
    .from("user_goals")
    .delete()
    .eq("id", id)
    .eq("user_id", actor.viewer.id);

  if (deleteError) {
    throw new Error("Goal delete failed.");
  }

  await archiveNotionGoal({
    goalId: id,
    userId: actor.viewer.id,
    title: data.title
  }).catch(() => undefined);

  return true;
}

async function rebuildUserStatsFromCompletions(userId: string): Promise<UserStats> {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return createEmptyStats();
  }

  const { data, error } = await supabase
    .from("quest_completions")
    .select("xp_earned, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (error) {
    throw new Error("Quest completion stats rebuild failed.");
  }

  const completions = (data ?? []) as CompletionRow[];
  const xp = completions.reduce((total, entry) => total + (entry.xp_earned ?? 0), 0);
  const uniqueDates = Array.from(
    new Set(completions.map((entry) => toIsoDate(new Date(entry.completed_at))))
  ).sort((a, b) => b.localeCompare(a));

  const lastCompletedDate = uniqueDates[0] ?? null;
  const stats = {
    xp,
    level: getLevelFromXp(xp),
    streak: countConsecutiveDates(uniqueDates),
    lastCompletedDate
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      xp: stats.xp,
      level: stats.level,
      streak: stats.streak,
      last_completed_date: stats.lastCompletedDate
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error("User stats rebuild update failed.");
  }

  return stats;
}

function countConsecutiveDates(sortedDatesDesc: string[]) {
  if (sortedDatesDesc.length === 0) {
    return 0;
  }

  const dateSet = new Set(sortedDatesDesc);
  const cursor = new Date(`${sortedDatesDesc[0]}T00:00:00.000Z`);
  let streak = 0;

  while (dateSet.has(toIsoDate(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function mapManualQuestRow(row: ManualQuestRow): Quest {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "직접 입력한 퀘스트입니다.",
    category: row.category,
    startTime: row.start_time,
    endTime: row.end_time,
    xp: row.xp,
    completed: row.completed,
    source: "manual"
  };
}

function mapGoalRow(row: GoalRow): SavedGoal {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: getDateDistanceInDays(row.start_date, row.end_date),
    dailyHours: Number(row.daily_hours) || 0,
    level: row.level,
    plan: isGoalPlan(row.plan_json) ? row.plan_json : createFallbackGoalPlan(row.title),
    createdAt: row.created_at
  };
}

function isGoalPlan(value: unknown): value is GoalPlan {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as GoalPlan).summary === "string" &&
    typeof (value as GoalPlan).advice === "string" &&
    Array.isArray((value as GoalPlan).weeks)
  );
}

function getDateDistanceInDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const distance = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

  return Number.isFinite(distance) && distance > 0 ? distance : 1;
}

function createFallbackGoalPlan(title: string): GoalPlan {
  return {
    summary: `${title} 저장 플랜`,
    advice: "저장된 플랜 내용을 불러오지 못했습니다.",
    weeks: []
  };
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

function createSignedInEmptyDashboardSnapshot(
  viewer: DashboardSnapshot["viewer"],
  overrides: Partial<Pick<DashboardSnapshot, "stats" | "weekProgress" | "quests">> = {}
): DashboardSnapshot {
  const quests = overrides.quests ?? [];

  return {
    viewer,
    stats: overrides.stats ?? createEmptyStats(),
    weekProgress: overrides.weekProgress ?? createEmptyWeekProgress(),
    weeklyMission: null,
    quests,
    onboardingState: quests.length > 0 ? "ready" : "needs_setup",
    config: {
      authConfigured: has.auth,
      supabaseConfigured: has.supabase,
      aiConfigured: has.ai,
      calendarConnected: false
    }
  };
}
