import { env, has } from "@/lib/env";
import { createMockGoalPlan } from "@/lib/mock-data";
import { createDailyQuests } from "@/lib/quests";
import { type CalendarEvent, type GoalInput, type GoalPlan, type Quest, type WeeklyMission } from "@/lib/types";
import { stripJsonFence } from "@/lib/utils";

const GOOGLE_AI_MODEL = "gemma-4";

async function callGoogleAi(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent?key=${env.googleAiApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Google AI request failed.");
  }

  const payload = await response.json();

  return (
    payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? ""
  );
}

export async function generateQuestPlanWithAi(input: {
  todayEvents: CalendarEvent[];
  weeklyMission: WeeklyMission | null;
  now?: Date;
}): Promise<Quest[]> {
  if (!has.ai) {
    return createDailyQuests(input);
  }

  const prompt = [
    "다음 정보를 바탕으로 오늘의 학습 퀘스트를 JSON 배열로만 반환해주세요.",
    "형식: [{ title, description, category, startTime, endTime, xp }]",
    "category는 sql, coding, study, review 중 하나만 사용합니다.",
    `todayEvents: ${JSON.stringify(input.todayEvents)}`,
    `weeklyMission: ${JSON.stringify(input.weeklyMission)}`
  ].join("\n");

  try {
    const raw = await callGoogleAi(prompt);
    const parsed = JSON.parse(stripJsonFence(raw)) as Quest[];

    return parsed.map((quest, index) => ({
      ...quest,
      id: `ai-quest-${index + 1}`,
      completed: false,
      source: input.todayEvents.length > 0 ? "calendar" : "weekly-mission"
    }));
  } catch {
    return createDailyQuests(input);
  }
}

export async function generateGoalPlanWithAi(input: GoalInput): Promise<GoalPlan> {
  if (!has.ai) {
    return createMockGoalPlan(input);
  }

  const prompt = [
    "다음 학습 목표를 한국어 JSON으로 설계해주세요.",
    "형식: { summary, advice, weeks: [{ week, theme, daily: [{ day, tasks }] }] }",
    `goal: ${input.title}`,
    `category: ${input.category}`,
    `duration: ${input.durationLabel} (${input.durationDays} days)`,
    `dailyHours: ${input.dailyHours}`,
    `currentLevel: ${input.currentLevel}`
  ].join("\n");

  try {
    const raw = await callGoogleAi(prompt);
    return JSON.parse(stripJsonFence(raw)) as GoalPlan;
  } catch {
    return createMockGoalPlan(input);
  }
}
