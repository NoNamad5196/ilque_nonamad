import "server-only";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  writeFile,
  open,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { createServiceSupabaseClient } from "../supabase/server";
import { emptyWorkspace, type Workspace, type Task } from "./model";
import { DomainError } from "./commands";
import { dateKey, dayDistance } from "./time";
import { QUEST_XP } from "../utils";
import { goalPlanSchema } from "../validators";

export function storageMode(): "file" | "supabase" {
  return process.env.ILQUE_STORAGE === "file" ? "file" : "supabase";
}
const storageKey = (id: string) =>
  createHash("sha256").update(`ilque-v2:${id}`).digest("hex");
function stateId(id: string) {
  const s = storageKey(id);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}
function db() {
  const client = createServiceSupabaseClient();
  if (!client)
    throw new DomainError(
      "저장소가 설정되지 않았어요. 설정 안내를 확인해 주세요.",
      503,
    );
  return client;
}
function validateState(value: unknown): Workspace {
  const v = value as Workspace;
  if (
    !v ||
    v.version !== 2 ||
    !Number.isInteger(v.revision) ||
    !Array.isArray(v.tasks) ||
    !Array.isArray(v.goals) ||
    !v.settings
  )
    throw new DomainError(
      "저장 데이터 형식을 확인해야 해요. 원본 데이터는 유지됩니다.",
      503,
    );
  return v;
}
const conflict = () =>
  new DomainError(
    "다른 화면에서 계획이 변경됐어요. 최신 데이터를 불러온 뒤 다시 시도해 주세요.",
    409,
  );
const unavailable = () =>
  new DomainError(
    "Supabase 저장소에 연결하지 못했어요. 연결을 복구한 뒤 다시 시도해 주세요. 변경은 저장되지 않았습니다.",
    503,
  );

export async function readWorkspace(userId: string): Promise<Workspace> {
  if (!userId) throw new DomainError("로그인이 필요합니다.", 401);
  if (storageMode() === "file") {
    try {
      return validateState(
        JSON.parse(
          await readFile(
            path.join(
              process.cwd(),
              ".local-data",
              `${storageKey(userId)}.json`,
            ),
            "utf8",
          ),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return emptyWorkspace();
      throw error;
    }
  }
  const client = db();
  const { data, error } = await client
    .from("user_goals")
    .select("plan_json")
    .eq("user_id", userId)
    .eq("id", stateId(userId))
    .maybeSingle();
  if (error) throw unavailable();
  if (data) return validateState(data.plan_json);
  return importLegacy(userId);
}

/** One document keeps quest status, reward and audit history in the same atomic write.
 * Existing JSONB storage avoids destructive schema or identity migration. */
export async function saveWorkspace(
  userId: string,
  state: Workspace,
  expectedRevision: number,
): Promise<Workspace> {
  const next = { ...state, revision: expectedRevision + 1 };
  if (storageMode() === "file") {
    const directory = path.join(process.cwd(), ".local-data");
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${storageKey(userId)}.json`),
      lock = `${file}.lock`,
      temp = `${file}.${crypto.randomUUID()}.tmp`;
    let handle;
    try {
      handle = await open(lock, "wx");
    } catch {
      throw conflict();
    }
    try {
      const current = await readWorkspace(userId);
      if (current.revision !== expectedRevision) throw conflict();
      await writeFile(temp, JSON.stringify(next), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temp, file);
    } finally {
      await handle.close();
      await unlink(lock);
      await unlink(temp).catch(() => undefined);
    }
    return next;
  }
  const client = db();
  if (expectedRevision === 0) {
    const today = dateKey(new Date());
    const { error } = await client.from("user_goals").insert({
      id: stateId(userId),
      user_id: userId,
      title: "ILQue V2 작업 공간",
      category: "__workspace_v2__",
      start_date: today,
      end_date: today,
      daily_hours: 2,
      level: "v2",
      plan_json: next,
      is_active: false,
    });
    if (error?.code === "23505") throw conflict();
    if (error) throw unavailable();
  } else {
    const { data, error } = await client
      .from("user_goals")
      .update({ plan_json: next })
      .eq("id", stateId(userId))
      .eq("user_id", userId)
      .eq("plan_json->>revision", String(expectedRevision))
      .select("id");
    if (error) throw unavailable();
    if (!data?.length) throw conflict();
  }
  return next;
}

async function importLegacy(userId: string): Promise<Workspace> {
  const client = db(),
    state = emptyWorkspace();
  const [goals, quests, completions] = await Promise.all([
    client
      .from("user_goals")
      .select("*")
      .eq("user_id", userId)
      .neq("category", "__workspace_v2__"),
    client.from("manual_quests").select("*").eq("user_id", userId),
    client
      .from("quest_completions")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: true }),
  ]);
  if (goals.error || quests.error || completions.error) throw unavailable();
  state.goals = (goals.data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    description: "기존 목표에서 가져왔어요",
    category: "study",
    deadline: g.end_date,
    totalMinutes: Math.max(
      30,
      Number(g.daily_hours) *
        60 *
        Math.max(1, dayDistance(g.start_date, g.end_date) + 1),
    ),
    level: g.level,
    createdAt: g.created_at,
    archived: !g.is_active,
  }));
  state.tasks = (quests.data ?? []).map(
    (q) =>
      ({
        id: q.id,
        title: q.title,
        description: q.description,
        category: q.category,
        estimatedMinutes: Math.min(
          480,
          Math.max(
            5,
            Math.round(
              (Date.parse(q.end_time) - Date.parse(q.start_time)) / 60000,
            ),
          ),
        ),
        status: q.completed ? "completed" : "pending",
        origin: "manual",
        xp: 0,
        locked: false,
        postponements: 0,
        createdAt: q.created_at,
      }) as Task,
  );
  for (const t of state.tasks)
    if (t.status !== "completed") t.xp = QUEST_XP[t.category];
  state.baseXp = (completions.data ?? []).reduce((s, c) => s + c.xp_earned, 0);
  state.legacyCompletedDates = [
    ...new Set((completions.data ?? []).map((c) => dateKey(c.completed_at))),
  ];
  state.activities = (completions.data ?? []).reverse().map((c) => ({
    id: c.id,
    title: c.quest_title,
    action: "legacy.complete",
    at: c.completed_at,
    xp: c.xp_earned,
  }));
  for (const g of goals.data ?? []) {
    const parsed = goalPlanSchema.safeParse(g.plan_json);
    if (!parsed.success) continue;
    parsed.data.weeks
      .flatMap((w) => w.daily.flatMap((d) => d.tasks))
      .slice(0, 200)
      .forEach((title, i) =>
        state.tasks.push({
          id: `legacy-${g.id}-${i}`,
          title,
          description: "기존 목표 플랜에서 가져온 학습 작업",
          category: "study",
          goalId: g.id,
          estimatedMinutes: 30,
          status: "pending",
          origin: "ai",
          xp: QUEST_XP.study,
          locked: false,
          postponements: 0,
          createdAt: g.created_at,
        }),
      );
  }
  return state;
}
