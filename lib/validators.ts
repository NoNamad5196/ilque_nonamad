import { z } from "zod";

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
  source: z.enum(["calendar", "weekly-mission", "manual"]).optional().default("manual")
});

export const manualQuestSchema = z.object({
  title: z.string().trim().min(1, "퀘스트 이름을 입력해주세요."),
  description: z.string().trim().default("직접 입력한 퀘스트입니다."),
  category: questCategorySchema.optional()
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
