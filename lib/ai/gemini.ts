import { env, has } from "@/lib/env";
import { createMockGoalPlan } from "@/lib/mock-data";
import { isWeeklyMissionEvent } from "@/lib/calendar";
import { createDailyQuests } from "@/lib/quests";
import {
  type CalendarEvent,
  type GoalInput,
  type GoalPlan,
  type LearningSource,
  type Quest,
  type QuestCategory,
  type WebSourceResult,
  type WeeklyMission
} from "@/lib/types";
import { QUEST_XP, guessCategoryFromText, stableId, stripJsonFence } from "@/lib/utils";

async function callGoogleAi(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.googleAiModel}:generateContent?key=${env.googleAiApiKey}`,
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

async function callGoogleAiWithSearch(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.googleAiModel}:generateContent?key=${env.googleAiApiKey}`,
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
        tools: [
          {
            google_search: {}
          }
        ]
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Google AI search request failed.");
  }

  const payload = await response.json();
  const candidate = payload?.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? "";
  const groundingMetadata = candidate?.groundingMetadata ?? candidate?.grounding_metadata ?? {};

  return {
    text,
    groundingMetadata
  };
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
    "todayEvents는 오늘 실행할 일일 퀘스트입니다.",
    "weeklyMission은 이번 주 방향을 알려주는 배경 정보입니다.",
    "todayEvents가 있으면 weeklyMission 자체를 별도 퀘스트로 만들지 마세요.",
    "todayEvents가 비어 있을 때만 weeklyMission 설명에서 오늘 실행할 작은 작업 1~3개를 뽑아주세요.",
    `todayEvents: ${JSON.stringify(input.todayEvents)}`,
    `weeklyMission: ${JSON.stringify(input.weeklyMission)}`
  ].join("\n");

  try {
    const raw = await callGoogleAi(prompt);
    const parsed = JSON.parse(stripJsonFence(raw)) as Quest[];
    const source = input.todayEvents.length > 0 ? "calendar" as const : "weekly-mission" as const;
    const quests = parsed
      .map((quest, index) => ({
        ...quest,
        id: `ai-quest-${index + 1}`,
        completed: false,
        source
      }))
      .filter((quest) => !isWeeklyMissionQuest(quest, input.weeklyMission));

    return quests.length > 0 ? quests : createDailyQuests(input);
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

export async function refineGoalPlanWithAi(input: {
  goal: GoalInput;
  plan: GoalPlan;
  instruction: string;
}): Promise<GoalPlan> {
  if (!has.ai) {
    return input.plan;
  }

  const prompt = [
    "다음 학습 플랜을 사용자의 수정 요청에 맞게 다시 설계해주세요.",
    "반드시 한국어 JSON만 반환해주세요.",
    "형식: { summary, advice, weeks: [{ week, theme, daily: [{ day, tasks }] }] }",
    "기존 목표 정보와 기간은 최대한 유지하되, 수정 요청이 우선입니다.",
    "수정 요청이 특정 조건을 말하면 그 조건을 플랜 전체에 반영해주세요.",
    `goalInput: ${JSON.stringify(input.goal)}`,
    `currentPlan: ${JSON.stringify(input.plan)}`,
    `revisionRequest: ${input.instruction}`
  ].join("\n");

  try {
    const raw = await callGoogleAi(prompt);
    return JSON.parse(stripJsonFence(raw)) as GoalPlan;
  } catch {
    return input.plan;
  }
}

export async function generateSourceQuestPlanWithAi(input: {
  sources: LearningSource[];
  now?: Date;
}): Promise<Quest[]> {
  if (input.sources.length === 0) {
    return [];
  }

  if (!has.ai) {
    return createSourceQuestFallback(input.sources, input.now);
  }

  const prompt = [
    "다음 Notion Sources 자료를 오늘 실행할 학습 퀘스트로 바꿔주세요.",
    "반드시 JSON 배열만 반환해주세요.",
    "형식: [{ title, description, category, xp }]",
    "category는 sql, coding, study, review 중 하나만 사용합니다.",
    "퀘스트는 1~5개만 만들고, 각 퀘스트는 오늘 바로 실행 가능한 작은 행동이어야 합니다.",
    "자료 전체를 읽으라는 식보다 '핵심 정리', '예제 풀이', '오답 카드 만들기'처럼 행동 중심으로 작성해주세요.",
    `sources: ${JSON.stringify(input.sources)}`
  ].join("\n");

  try {
    const raw = await callGoogleAi(prompt);
    const parsed = JSON.parse(stripJsonFence(raw)) as Array<Partial<Quest>>;
    const quests = parsed
      .map((quest, index) => normalizeSourceQuest(quest, input.sources, index, input.now))
      .filter(Boolean) as Quest[];

    return quests.length > 0 ? quests.slice(0, 5) : createSourceQuestFallback(input.sources, input.now);
  } catch {
    return createSourceQuestFallback(input.sources, input.now);
  }
}

export async function searchWebSourcesWithAi(query: string): Promise<{
  results: WebSourceResult[];
  searchHtml?: string;
}> {
  if (!has.ai) {
    return {
      results: []
    };
  }

  const prompt = [
    "Google Search를 사용해서 학습 자료 후보를 찾아주세요.",
    "반드시 JSON 객체만 반환해주세요.",
    "형식: { results: [{ title, url, summary, category }] }",
    "results는 최대 5개입니다.",
    "category는 sql, coding, study, review 중 하나만 사용합니다.",
    "summary는 한국어로 1~2문장만 작성합니다.",
    "공식 문서, 강의/튜토리얼, 신뢰 가능한 학습 자료를 우선합니다.",
    `searchQuery: ${query}`
  ].join("\n");

  const { text, groundingMetadata } = await callGoogleAiWithSearch(prompt);
  const chunks = readGroundingChunks(groundingMetadata);
  const parsed = parseSearchResults(text);
  const results = parsed.length > 0 ? parsed : chunks.map((chunk) => ({
    title: chunk.title,
    url: chunk.url,
    summary: "Google Search Grounding으로 찾은 학습 자료입니다.",
    category: guessCategoryFromText(`${query} ${chunk.title}`)
  }));

  return {
    results: normalizeWebResults(results, query).slice(0, 5),
    searchHtml: groundingMetadata?.searchEntryPoint?.renderedContent
  };
}

function isWeeklyMissionQuest(quest: Pick<Quest, "title" | "description">, weeklyMission: WeeklyMission | null) {
  const title = quest.title.trim();
  const missionTitle = weeklyMission?.title.trim();

  return (
    isWeeklyMissionEvent({
      summary: title,
      description: quest.description
    }) ||
    Boolean(missionTitle && title === missionTitle)
  );
}

function normalizeSourceQuest(
  quest: Partial<Quest>,
  sources: LearningSource[],
  index: number,
  now = new Date()
): Quest | null {
  const title = typeof quest.title === "string" ? quest.title.trim() : "";

  if (!title) {
    return null;
  }

  const description =
    typeof quest.description === "string" && quest.description.trim()
      ? quest.description.trim()
      : createSourceQuestDescription(sources[index % sources.length]);
  const category = normalizeCategory(quest.category, `${title} ${description}`);
  const startTime = new Date(now.getTime() + index * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  const xp = Number.isFinite(quest.xp) && Number(quest.xp) > 0 ? Number(quest.xp) : QUEST_XP[category];

  return {
    id: stableId("notion-source", title, String(index + 1)),
    title,
    description,
    category,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    xp,
    completed: false,
    source: "notion-source"
  };
}

function createSourceQuestFallback(sources: LearningSource[], now = new Date()): Quest[] {
  return sources.slice(0, 3).map((source, index) => {
    const title = `${source.title} 핵심 정리`;
    const description = createSourceQuestDescription(source);
    const category = normalizeCategory(source.category, `${title} ${description}`);
    const startTime = new Date(now.getTime() + index * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    return {
      id: stableId("notion-source", source.id, title),
      title,
      description,
      category,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      xp: QUEST_XP[category],
      completed: false,
      source: "notion-source"
    };
  });
}

function createSourceQuestDescription(source: LearningSource) {
  const summary = source.summary || "Notion Sources에 모아둔 자료를 바탕으로 오늘 실행할 학습 작업입니다.";
  const url = source.url ? `\n자료 링크: ${source.url}` : "";

  return `${summary}${url}`;
}

function normalizeCategory(category: unknown, fallbackText: string): QuestCategory {
  return category === "sql" || category === "coding" || category === "study" || category === "review"
    ? category
    : guessCategoryFromText(fallbackText);
}

function parseSearchResults(text: string): Array<Omit<WebSourceResult, "id">> {
  try {
    const parsed = JSON.parse(stripJsonFence(text));
    const results = Array.isArray(parsed) ? parsed : parsed?.results;

    if (!Array.isArray(results)) {
      return [];
    }

    return results
      .map((result) => ({
        title: typeof result?.title === "string" ? result.title : "",
        url: typeof result?.url === "string" ? result.url : "",
        summary: typeof result?.summary === "string" ? result.summary : "",
        category: normalizeCategory(result?.category, `${result?.title ?? ""} ${result?.summary ?? ""}`)
      }))
      .filter((result) => result.title && isHttpUrl(result.url));
  } catch {
    return [];
  }
}

function normalizeWebResults(results: Array<Omit<WebSourceResult, "id">>, query: string): WebSourceResult[] {
  const unique = new Map<string, WebSourceResult>();

  results.forEach((result, index) => {
    if (!isHttpUrl(result.url)) {
      return;
    }

    const title = result.title.trim() || result.url;
    const summary = result.summary.trim() || "웹에서 찾은 학습 자료입니다.";
    const category = normalizeCategory(result.category, `${query} ${title} ${summary}`);

    unique.set(result.url, {
      id: stableId("web-source", result.url, String(index + 1)),
      title,
      url: result.url,
      summary,
      category
    });
  });

  return Array.from(unique.values());
}

function readGroundingChunks(metadata: any): Array<{ title: string; url: string }> {
  const chunks = metadata?.groundingChunks ?? metadata?.grounding_chunks ?? [];

  if (!Array.isArray(chunks)) {
    return [];
  }

  return chunks
    .map((chunk) => {
      const web = chunk?.web ?? {};
      return {
        title: typeof web.title === "string" ? web.title : "",
        url: typeof web.uri === "string" ? web.uri : ""
      };
    })
    .filter((chunk) => chunk.title && isHttpUrl(chunk.url));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
