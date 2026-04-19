export type QuestCategory = "sql" | "coding" | "study" | "review";

export type QuestSource = "calendar" | "weekly-mission" | "manual";

export interface Viewer {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

export interface WeeklyMission {
  title: string;
  description: string;
  weekLabel: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  startTime: string;
  endTime: string;
  xp: number;
  completed: boolean;
  source: QuestSource;
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastCompletedDate?: string | null;
}

export interface WeeklyProgressDay {
  label: string;
  date: string;
  completed: boolean;
  isToday: boolean;
}

export interface HistoryEntry {
  id: string;
  questTitle: string;
  category: QuestCategory;
  xpEarned: number;
  completedAt: string;
}

export type OnboardingState = "ready" | "needs_setup" | "manual_only";

export interface GoalInput {
  title: string;
  category: string;
  durationLabel: string;
  durationDays: number;
  dailyHours: string;
  currentLevel: string;
}

export interface GoalPlanDay {
  day: string;
  tasks: string[];
}

export interface GoalPlanWeek {
  week: number;
  theme: string;
  daily: GoalPlanDay[];
}

export interface GoalPlan {
  summary: string;
  advice: string;
  weeks: GoalPlanWeek[];
}

export interface DashboardSnapshot {
  viewer: Viewer;
  stats: UserStats;
  weekProgress: WeeklyProgressDay[];
  weeklyMission: WeeklyMission | null;
  quests: Quest[];
  onboardingState: OnboardingState;
  config: {
    authConfigured: boolean;
    supabaseConfigured: boolean;
    aiConfigured: boolean;
    calendarConnected: boolean;
  };
}
