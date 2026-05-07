import { type QuestCategory } from "@/lib/types";

export const QUEST_XP: Record<QuestCategory, number> = {
  sql: 10,
  coding: 20,
  study: 30,
  review: 15
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getLevelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export function getXpIntoCurrentLevel(xp: number) {
  return xp % 100;
}

export function formatClock(input?: string | null) {
  if (!input) {
    return "--:--";
  }

  const date = new Date(input);

  if (!Number.isFinite(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function guessCategoryFromText(text: string): QuestCategory {
  const source = text.toLowerCase();

  if (source.includes("sql") || source.includes("db") || source.includes("query")) {
    return "sql";
  }

  if (source.includes("코테") || source.includes("coding") || source.includes("code")) {
    return "coding";
  }

  if (source.includes("복습") || source.includes("review")) {
    return "review";
  }

  return "study";
}

export function stripJsonFence(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

export function toIsoDate(input: Date) {
  return input.toISOString().slice(0, 10);
}

export function getWeekDays(now = new Date()) {
  const current = new Date(now);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(current.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);

    return date;
  });
}

export function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    weekday: "short"
  }).format(date);
}

export function stableId(...parts: string[]) {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
