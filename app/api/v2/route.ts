import { mergeCalendar } from "@/lib/v2/calendar-sync";
import { z } from "zod";
import { getApiActor } from "@/lib/auth";
import { readWorkspace, saveWorkspace, storageMode } from "@/lib/v2/store";
import { applyCommand, commandSchema, DomainError } from "@/lib/v2/commands";
import { decomposeGoal, decompositionSchema } from "@/lib/v2/ai";
import { scheduleWorkspace } from "@/lib/v2/scheduler";
import { fetchCalendarRange, isWeeklyMissionEvent } from "@/lib/calendar";
import { addDays, dateKey, weekKey } from "@/lib/v2/time";
import { has } from "@/lib/env";
import {
  getNotionSources,
  recordWebSourceToNotion,
} from "@/lib/notion/records";
import { QUEST_XP } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const extras = z.discriminatedUnion("type", [
  z.object({ type: z.literal("calendar.sync") }),
  z.object({ type: z.literal("notion.import") }),
  z.object({ type: z.literal("notion.export"), sourceId: z.string().max(200) }),
  z.object({
    type: z.literal("ai.preview"),
    goalId: z.string().max(100),
    instruction: z.string().max(2000).default(""),
  }),
  z.object({
    type: z.literal("ai.apply"),
    goalId: z.string().max(100),
    plan: decompositionSchema,
  }),
]);
const requestSchema = z.object({
  revision: z.number().int().min(0),
  command: z.union([commandSchema, extras]),
});
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const failure = (error: unknown) =>
  json(
    {
      error:
        error instanceof DomainError
          ? error.message
          : "처리하지 못했어요. 저장 상태를 확인한 뒤 다시 시도해 주세요.",
    },
    error instanceof DomainError ? error.status : 503,
  );
const notionAllowed = (email: string) =>
  Boolean(process.env.ILQUE_NOTION_OWNER_EMAIL) &&
  email.toLowerCase() ===
    process.env.ILQUE_NOTION_OWNER_EMAIL?.trim().toLowerCase();

export async function GET() {
  const actor = await getApiActor();
  if (!actor) return json({ error: "로그인이 필요합니다." }, 401);
  try {
    const state = await readWorkspace(actor.viewer.id);
    return json({
      state,
      config: {
        storage: storageMode(),
        ai: has.ai,
        calendar: Boolean(actor.accessToken),
        notion: has.notion && notionAllowed(actor.viewer.email),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  const actor = await getApiActor();
  if (!actor) return json({ error: "로그인이 필요합니다." }, 401);
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return json(
      {
        error: "입력한 값과 날짜·시간을 확인해 주세요.",
        details: body.error.flatten(),
      },
      400,
    );
  try {
    const { revision, command } = body.data;
    let state = await readWorkspace(actor.viewer.id);
    if (state.revision !== revision)
      throw new DomainError(
        "다른 화면에서 계획이 변경됐어요. 새로 불러온 뒤 다시 시도해 주세요.",
        409,
      );
    let notice: string | undefined;
    if (command.type === "ai.preview") {
      const goal = state.goals.find(
        (g) => g.id === command.goalId && !g.archived,
      );
      if (!goal) throw new DomainError("목표를 먼저 선택해 주세요.", 404);
      try {
        return json({
          preview: await decomposeGoal(
            goal,
            state.sources.filter((s) => s.goalId === goal.id),
            command.instruction,
            state.tasks.filter((task) => task.goalId === goal.id),
          ),
        });
      } catch (error) {
        throw new DomainError((error as Error).message, 502);
      }
    } else if (command.type === "ai.apply") {
      const goal = state.goals.find(
        (g) => g.id === command.goalId && !g.archived,
      );
      if (!goal) throw new DomainError("목표를 찾지 못했어요.", 404);
      const existing = new Set(
        state.tasks
          .filter((t) => t.goalId === goal.id)
          .map((t) => t.title.trim()),
      );
      for (const task of command.plan.tasks) {
        if (existing.has(task.title.trim())) continue;
        existing.add(task.title.trim());
        state.tasks.push({
          ...task,
          id: crypto.randomUUID(),
          goalId: goal.id,
          category: goal.category,
          origin: "ai",
          status: "pending",
          xp: QUEST_XP[goal.category],
          locked: false,
          postponements: 0,
          createdAt: new Date().toISOString(),
        });
      }
      state.activities.unshift({
        id: crypto.randomUUID(),
        title: `AI 계획 적용 · ${goal.title}`,
        action: "ai.apply",
        at: new Date().toISOString(),
      });
      state = scheduleWorkspace(state);
    } else if (command.type === "calendar.sync") {
      if (!actor.accessToken)
        throw new DomainError(
          "Google Calendar 연결을 위해 다시 로그인해 주세요.",
          401,
        );
      const today = dateKey(new Date(), state.settings.timeZone),
        monday = weekKey(today);
      try {
        const events = await fetchCalendarRange(
          actor.accessToken,
          monday,
          21,
          state.settings.timeZone,
        );
        state = mergeCalendar(state, events);
      } catch {
        state.calendarError = "캘린더 연결 실패";
        notice =
          "캘린더를 읽지 못했어요. 저장된 일정을 유지했습니다. 다시 로그인하거나 잠시 후 동기화해 주세요.";
      }
      state = scheduleWorkspace(state);
    } else if (
      command.type === "notion.import" ||
      command.type === "notion.export"
    ) {
      if (!has.notion || !notionAllowed(actor.viewer.email))
        throw new DomainError(
          "이 계정의 Notion 연결이 설정되지 않았어요. 설정 안내를 확인해 주세요.",
          403,
        );
      if (command.type === "notion.import") {
        const sources = await getNotionSources(100, true);
        state.sources = [
          ...state.sources.filter((s) => s.origin !== "notion"),
          ...sources.map((s) => ({
            id: s.id,
            title: s.title,
            summary: s.summary,
            url: s.url && /^https?:\/\//i.test(s.url) ? s.url : undefined,
            goalId: state.sources.find((old) => old.id === s.id)?.goalId,
            origin: "notion" as const,
          })),
        ];
        notice = `${sources.length}개의 Notion 자료를 불러왔어요.`;
      } else {
        const source = state.sources.find((s) => s.id === command.sourceId);
        if (!source?.url)
          throw new DomainError("내보낼 자료에 링크가 필요해요.");
        const page = await recordWebSourceToNotion({
          source: { ...source, url: source.url, category: "study" },
          userId: actor.viewer.id,
        });
        if (!page)
          throw new DomainError(
            "Notion에 저장하지 못했어요. 연결 상태를 확인해 주세요.",
            503,
          );
        notice = "Notion 자료실에 저장했어요.";
      }
    } else {
      state = applyCommand(state, command);
    }
    const saved = await saveWorkspace(actor.viewer.id, state, revision);
    return json({ state: saved, notice });
  } catch (error) {
    return failure(error);
  }
}
