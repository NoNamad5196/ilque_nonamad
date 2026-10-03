import { z } from "zod";
import { type Workspace, type Task, type Goal } from "./model";
import { dateKey, weekKey, zonedInstant, clockLabel } from "./time";
import { scheduleWorkspace } from "./scheduler";
import { QUEST_XP } from "../utils";

const text = z.string().trim().min(1).max(200);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "날짜가 올바르지 않습니다.");
const category = z.enum(["sql", "coding", "study", "review"]);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const goalData = z.object({
  id: z.string().max(100).optional(),
  title: text,
  description: z.string().max(2000).default(""),
  category,
  deadline: day,
  totalMinutes: z.number().int().min(15).max(100000),
  level: z.string().max(100).default("기초부터 시작"),
  archived: z.boolean().default(false),
});
const taskData = z.object({
  id: z.string().max(100).optional(),
  title: text,
  description: z.string().max(2000).default(""),
  category,
  estimatedMinutes: z.number().int().min(5).max(480),
  goalId: z.string().max(100).optional(),
  sourceId: z.string().max(200).optional(),
  deadline: day.optional(),
  date: day.optional(),
  time: clock.optional(),
  locked: z.boolean().default(false),
});
const url = z
  .string()
  .url()
  .max(2000)
  .refine(
    (v) => /^https?:\/\//i.test(v),
    "http 또는 https 링크만 저장할 수 있어요.",
  );
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goal.save"), data: goalData }),
  z.object({ type: z.literal("quest.save"), data: taskData }),
  z.object({
    type: z.literal("quest.complete"),
    id: text,
    actualMinutes: z.number().int().min(1).max(1440),
  }),
  z.object({ type: z.literal("quest.undo"), id: text }),
  z.object({ type: z.literal("quest.postpone"), id: text, date: day }),
  z.object({ type: z.literal("quest.skip"), id: text }),
  z.object({ type: z.literal("quest.restore"), id: text }),
  z.object({
    type: z.literal("source.save"),
    data: z.object({
      id: z.string().max(200).optional(),
      title: text,
      summary: z.string().max(2000).default(""),
      url: url.optional(),
      goalId: z.string().max(100).optional(),
    }),
  }),
  z.object({
    type: z.literal("mission.save"),
    title: text,
    target: z.number().int().min(1).max(100),
    goalId: z.string().max(100).optional(),
  }),
  z.object({
    type: z.literal("settings.save"),
    data: z
      .object({
        timeZone: z
          .string()
          .max(100)
          .refine((v) => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: v });
              return true;
            } catch {
              return false;
            }
          }),
        dayStart: clock,
        dayEnd: clock,
        dailyMinutes: z.number().int().min(15).max(720),
        breakMinutes: z.number().int().min(0).max(60),
      })
      .refine(
        (v) => v.dayEnd > v.dayStart,
        "종료 시간을 시작 시간 이후로 설정해 주세요.",
      ),
  }),
  z.object({ type: z.literal("replan") }),
]);
export type Command = z.infer<typeof commandSchema>;
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function applyCommand(
  input: Workspace,
  command: Command,
  now = new Date(),
  id = crypto.randomUUID(),
): Workspace {
  const state = structuredClone(input);
  const today = dateKey(now, state.settings.timeZone);
  let title = "계획을 다시 조정했어요",
    taskId: string | undefined,
    minutes: number | undefined,
    xp: number | undefined;
  const assertGoal = (goalId?: string) => {
    if (goalId && !state.goals.some((g) => g.id === goalId))
      throw new DomainError("연결할 목표를 찾지 못했어요.", 404);
  };
  if (command.type === "goal.save") {
    const previous = state.goals.find((g) => g.id === command.data.id);
    if (command.data.id && !previous)
      throw new DomainError("목표를 찾지 못했어요.", 404);
    const goal: Goal = {
      ...command.data,
      id: previous?.id ?? id,
      createdAt: previous?.createdAt ?? now.toISOString(),
    };
    assertGoal(command.data.id);
    state.goals = [...state.goals.filter((g) => g.id !== goal.id), goal];
    title = `목표 ${previous ? "수정" : "추가"} · ${goal.title}`;
  } else if (command.type === "quest.save") {
    const data = command.data;
    assertGoal(data.goalId);
    if (data.sourceId && !state.sources.some((s) => s.id === data.sourceId))
      throw new DomainError("학습 자료를 찾지 못했어요.", 404);
    const previous = state.tasks.find((t) => t.id === data.id);
    if (data.id && !previous)
      throw new DomainError("퀘스트를 찾지 못했어요.", 404);
    if (previous?.status === "completed")
      throw new DomainError("완료를 취소한 뒤 수정해 주세요.");
    if (data.locked && (!data.date || !data.time))
      throw new DomainError("고정할 날짜와 시간을 입력해 주세요.");
    const start = data.locked
      ? zonedInstant(data.date!, data.time!, state.settings.timeZone)
      : undefined;
    if (
      start &&
      (dateKey(start, state.settings.timeZone) !== data.date ||
        clockLabel(start.toISOString(), state.settings.timeZone) !== data.time)
    )
      throw new DomainError("선택한 시간대에 존재하지 않는 시각이에요.");
    const task: Task = {
      ...previous,
      id: previous?.id ?? id,
      title: data.title,
      description: data.description,
      category: data.category,
      goalId: data.goalId,
      sourceId: data.sourceId,
      origin: previous?.origin ?? (data.sourceId ? "source" : "manual"),
      estimatedMinutes: data.estimatedMinutes,
      status: previous?.status ?? "pending",
      xp: QUEST_XP[data.category],
      deadline: data.deadline,
      notBefore: data.date,
      scheduledStart: start?.toISOString(),
      scheduledEnd: start
        ? new Date(+start + data.estimatedMinutes * 60000).toISOString()
        : undefined,
      locked: data.locked,
      postponements: previous?.postponements ?? 0,
      createdAt: previous?.createdAt ?? now.toISOString(),
    };
    if (previous) task.userEdited = true;
    state.tasks = [...state.tasks.filter((t) => t.id !== task.id), task];
    title = `퀘스트 ${previous ? "수정" : "추가"} · ${task.title}`;
    taskId = task.id;
  } else if (command.type.startsWith("quest.") && "id" in command) {
    const task = state.tasks.find((t) => t.id === command.id);
    if (!task) throw new DomainError("퀘스트를 찾지 못했어요.", 404);
    taskId = task.id;
    if (command.type === "quest.complete") {
      if (task.status === "completed") return state;
      task.status = "completed";
      task.completedAt = now.toISOString();
      task.actualMinutes = command.actualMinutes;
      title = `퀘스트 완료 · ${task.title}`;
      minutes = command.actualMinutes;
      xp = task.xp;
    } else if (command.type === "quest.undo") {
      if (task.status !== "completed") return state;
      task.status = "pending";
      task.completedAt = undefined;
      task.actualMinutes = undefined;
      task.locked = false;
      task.userEdited = true;
      title = `완료 취소 · ${task.title}`;
      xp = -task.xp;
    } else if (command.type === "quest.postpone") {
      if (task.status === "completed")
        throw new DomainError("완료한 퀘스트는 미룰 수 없어요.");
      if (command.date <= today)
        throw new DomainError("내일 이후 날짜를 선택해 주세요.");
      task.notBefore = command.date;
      task.locked = false;
      task.postponements++;
      task.status = "pending";
      title = `${command.date}로 미루기 · ${task.title}`;
      task.userEdited = true;
    } else if (command.type === "quest.skip") {
      if (task.status === "completed")
        throw new DomainError("완료를 취소한 뒤 제외해 주세요.");
      task.status = "skipped";
      task.userEdited = true;
      title = `계획에서 제외 · ${task.title}`;
    } else if (command.type === "quest.restore") {
      if (task.status !== "skipped")
        throw new DomainError("제외한 퀘스트만 복구할 수 있어요.");
      task.status = "pending";
      task.locked = false;
      task.userEdited = true;
      title = `계획에 복구 · ${task.title}`;
    }
  } else if (command.type === "settings.save") {
    state.settings = command.data;
    title = "학습 가능 시간과 설정을 변경했어요";
  } else if (command.type === "source.save") {
    assertGoal(command.data.goalId);
    const previous = state.sources.find((s) => s.id === command.data.id);
    if (command.data.id && !previous)
      throw new DomainError("자료를 찾지 못했어요.", 404);
    const source = {
      ...command.data,
      id: previous?.id ?? id,
      origin: previous?.origin ?? ("manual" as const),
    };
    state.sources = [
      ...state.sources.filter((s) => s.id !== source.id),
      source,
    ];
    title = `자료 저장 · ${source.title}`;
  } else if (command.type === "mission.save") {
    assertGoal(command.goalId);
    const week = weekKey(today);
    state.missions = [
      ...state.missions.filter((m) => m.week !== week),
      {
        id,
        title: command.title,
        target: command.target,
        week,
        goalId: command.goalId,
      },
    ];
    title = `주간 미션 설정 · ${command.title}`;
  }
  state.activities.unshift({
    id,
    taskId,
    title,
    action: command.type,
    at: now.toISOString(),
    minutes,
    xp,
  });
  return scheduleWorkspace(state, now);
}
