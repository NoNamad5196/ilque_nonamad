import { z } from "zod";

const textFromUnknown = z.preprocess((value) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = record.title ?? record.name ?? record.text ?? record.task ?? record.description;

    if (typeof preferred === "string") {
      return preferred;
    }

    return JSON.stringify(value);
  }

  return "";
}, z.string().trim().min(1));

const taskListSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return [value];
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
}, z.array(textFromUnknown).min(1));

const goalPlanDaySchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    return {
      day: record.day ?? record.date ?? record.label ?? "오늘",
      tasks: record.tasks ?? record.task ?? record.items ?? record.activities ?? record.todos ?? []
    };
  }

  return {
    day: "오늘",
    tasks: value
  };
}, z.object({
  day: textFromUnknown,
  tasks: taskListSchema
}));

const goalPlanWeekSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    return {
      week: record.week ?? record.weekNumber ?? record.no ?? 1,
      theme: record.theme ?? record.title ?? record.name ?? `${record.week ?? 1}주차`,
      daily: record.daily ?? record.days ?? record.tasks ?? record.items ?? []
    };
  }

  return {
    week: 1,
    theme: "수정된 플랜",
    daily: value
  };
}, z.object({
  week: z.coerce.number().int().min(1),
  theme: textFromUnknown,
  daily: z.array(goalPlanDaySchema).min(1)
}));

export const questCategorySchema = z.enum(["sql", "coding", "study", "review"]);

export const questSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "퀘스트 이름을 입력해주세요."),
  description: z.string().trim().min(1, "퀘스트 설명을 입력해주세요."),
  category: questCategorySchema,
  startTime: z.string(),
  endTime: z.string(),
  xp: z.number(),
  completed: z.boolean().optional().default(false),
  source: z.enum(["calendar", "weekly-mission", "manual", "notion-source"]).optional().default("manual")
});

export const manualQuestSchema = z.object({
  title: z.string().trim().min(1, "퀘스트 이름을 입력해주세요."),
  description: z.string().trim().default("직접 입력한 퀘스트입니다."),
  category: questCategorySchema.optional()
});

export const webSourceSearchSchema = z.object({
  query: z.string().trim().min(2, "검색어를 2글자 이상 입력해주세요.").max(120, "검색어는 120자 이내로 입력해주세요.")
});

export const webSourceSaveSchema = z.object({
  title: z.string().trim().min(1, "자료 제목이 필요합니다.").max(200),
  url: z.string().trim().url("자료 URL이 올바르지 않습니다."),
  summary: z.string().trim().min(1, "자료 요약이 필요합니다.").max(1800),
  category: questCategorySchema.default("study")
});

export const goalInputSchema = z.object({
  title: z.string().trim().min(1, "목표 이름을 입력해주세요."),
  category: z.string().trim().min(1, "목표 종류를 입력해주세요."),
  durationLabel: z.string().trim().min(1, "목표 기간을 입력해주세요."),
  durationDays: z.coerce.number().int().min(1, "목표 기간은 1일 이상이어야 합니다."),
  dailyHours: z.string().trim().min(1, "하루 학습 시간을 선택해주세요."),
  currentLevel: z.string().trim().min(1, "현재 수준을 선택해주세요."),
  persist: z.boolean().optional().default(false)
});

export const goalPlanSchema = z.object({
  summary: textFromUnknown,
  advice: textFromUnknown,
  weeks: z.preprocess((value) => Array.isArray(value) ? value : [], z.array(goalPlanWeekSchema).min(1))
}).passthrough();

export const goalPlanSaveSchema = goalInputSchema.extend({
  plan: goalPlanSchema.optional()
});

export const goalPlanRefineSchema = goalInputSchema.omit({ persist: true }).extend({
  plan: goalPlanSchema,
  instruction: z.string().trim().min(1, "수정 요청을 입력해주세요.")
});
