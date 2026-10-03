import type { CalendarEvent, QuestCategory } from "../types";

export type Status = "pending" | "completed" | "skipped";
export interface Task {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  goalId?: string;
  sourceId?: string;
  origin: "manual" | "ai" | "calendar" | "source" | "mission";
  estimatedMinutes: number;
  actualMinutes?: number;
  status: Status;
  xp: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  notBefore?: string;
  deadline?: string;
  locked: boolean;
  postponements: number;
  createdAt: string;
  completedAt?: string;
  reason?: string;
  calendarEventId?: string;
  userEdited?: boolean;
}
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  deadline: string;
  totalMinutes: number;
  level: string;
  createdAt: string;
  archived: boolean;
}
export interface Source {
  id: string;
  title: string;
  summary: string;
  url?: string;
  goalId?: string;
  origin: "manual" | "notion" | "web";
}
export interface Mission {
  id: string;
  title: string;
  target: number;
  week: string;
  goalId?: string;
}
export interface Activity {
  id: string;
  taskId?: string;
  title: string;
  action: string;
  at: string;
  minutes?: number;
  xp?: number;
}
export interface Settings {
  timeZone: string;
  dayStart: string;
  dayEnd: string;
  dailyMinutes: number;
  breakMinutes: number;
}
export interface PlanReport {
  at: string;
  scheduled: number;
  deferred: number;
  availableMinutes: number;
  plannedMinutes: number;
  completionRate: number;
  durationFactor: number;
  warnings: string[];
}
export interface Workspace {
  version: 2;
  revision: number;
  goals: Goal[];
  tasks: Task[];
  sources: Source[];
  missions: Mission[];
  activities: Activity[];
  settings: Settings;
  calendar: CalendarEvent[];
  calendarSyncedAt?: string;
  calendarRangeEnd?: string;
  calendarError?: string;
  report?: PlanReport;
  baseXp: number;
  legacyCompletedDates: string[];
}
export const defaultSettings: Settings = {
  timeZone: "Asia/Seoul",
  dayStart: "09:00",
  dayEnd: "23:00",
  dailyMinutes: 120,
  breakMinutes: 10,
};
export function emptyWorkspace(): Workspace {
  return {
    version: 2,
    revision: 0,
    goals: [],
    tasks: [],
    sources: [],
    missions: [],
    activities: [],
    settings: { ...defaultSettings },
    calendar: [],
    baseXp: 0,
    legacyCompletedDates: [],
  };
}
