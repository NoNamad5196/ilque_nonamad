import { type Workspace, type Task, type PlanReport } from "./model";
import { addDays, dateKey, dayDistance, zonedInstant } from "./time";

type Interval = [number, number];
const minute = 60000;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function subtractIntervals(
  window: Interval,
  blocked: Interval[],
): Interval[] {
  let slots: Interval[] = [window];
  for (const [start, end] of blocked
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0])) {
    slots = slots.flatMap(([s, e]) =>
      end <= s || start >= e
        ? [[s, e]]
        : ([
            [s, Math.min(start, e)],
            [Math.max(end, s), e],
          ].filter(([a, b]) => b > a) as Interval[]),
    );
  }
  return slots;
}
export function performance(state: Workspace, now = new Date()) {
  const recent = state.tasks.filter(
    (t) =>
      t.completedAt &&
      Date.parse(t.completedAt) >= now.getTime() - 14 * 86400000,
  );
  const ratios = recent
    .filter((t) => t.actualMinutes && t.estimatedMinutes)
    .map((t) => t.actualMinutes! / t.estimatedMinutes)
    .sort((a, b) => a - b);
  const durationFactor = ratios.length
    ? clamp(ratios[Math.floor(ratios.length / 2)], 0.65, 1.8)
    : 1;
  const missed = state.activities.filter(
    (a) =>
      ["quest.postpone", "quest.skip", "quest.missed"].includes(a.action) &&
      Date.parse(a.at) >= now.getTime() - 14 * 86400000,
  ).length;
  const attempts = recent.length + missed;
  const completionRate = attempts >= 3 ? recent.length / attempts : 1;
  return { durationFactor, completionRate };
}
export function scheduleWorkspace(
  input: Workspace,
  now = new Date(),
  horizon = 14,
): Workspace {
  const state = structuredClone(input);
  const { timeZone, dayStart, dayEnd, breakMinutes } = state.settings;
  const today = dateKey(now, timeZone);
  for (const t of state.tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.scheduledEnd &&
      dateKey(t.scheduledEnd, timeZone) < today,
  )) {
    const id = `missed-${t.id}-${dateKey(t.scheduledEnd!, timeZone)}`;
    if (!state.activities.some((a) => a.id === id))
      state.activities.unshift({
        id,
        taskId: t.id,
        title: `미완료 이월 · ${t.title}`,
        action: "quest.missed",
        at: now.toISOString(),
      });
  }
  const { durationFactor, completionRate } = performance(state, now);
  const budget = Math.max(
    15,
    Math.floor(
      state.settings.dailyMinutes * clamp(completionRate + 0.2, 0.5, 1),
    ),
  );
  const warnings = new Set<string>();
  const goals = new Map(state.goals.map((g) => [g.id, g]));
  const effectiveDeadline = (task: Task) =>
    [task.deadline, task.goalId ? goals.get(task.goalId)?.deadline : undefined]
      .filter((day): day is string => Boolean(day))
      .sort()[0];
  const calendarPins = new Set(
    state.tasks
      .filter(
        (t) =>
          t.origin === "calendar" &&
          t.locked &&
          t.status === "pending" &&
          (!t.goalId || !goals.get(t.goalId)?.archived) &&
          state.calendar.some(
            (event) =>
              event.id === t.calendarEventId &&
              Date.parse(event.start) === Date.parse(t.scheduledStart ?? "") &&
              Date.parse(event.end) === Date.parse(t.scheduledEnd ?? ""),
          ),
      )
      .map((t) => t.calendarEventId),
  );
  const blocked: Interval[] = state.calendar
    .filter((e) => !calendarPins.has(e.id))
    .map((e) => [
      e.isAllDay
        ? zonedInstant(e.start.slice(0, 10), "00:00", timeZone).getTime()
        : Date.parse(e.start),
      e.isAllDay
        ? zonedInstant(e.end.slice(0, 10), "00:00", timeZone).getTime()
        : Date.parse(e.end),
    ]);
  const pending = state.tasks.filter(
    (t) =>
      t.status === "pending" && (!t.goalId || !goals.get(t.goalId)?.archived),
  );
  for (const task of state.tasks.filter(
    (t) => t.status === "pending" && t.goalId && goals.get(t.goalId)?.archived,
  )) {
    task.scheduledStart = undefined;
    task.scheduledEnd = undefined;
    task.reason = "보관한 목표의 퀘스트예요";
  }
  const pinned = pending.filter(
    (t) => t.locked && t.scheduledStart && t.scheduledEnd,
  );
  for (const t of pinned) {
    const start = Date.parse(t.scheduledStart!),
      end = Date.parse(t.scheduledEnd!);
    const deadline = effectiveDeadline(t);
    if (blocked.some(([s, e]) => start < e && end > s))
      warnings.add(
        `「${t.title}」의 고정 시간이 다른 일정과 겹칩니다. 직접 시간을 수정해 주세요.`,
      );
    if (deadline && dateKey(t.scheduledEnd!, timeZone) > deadline)
      warnings.add(`「${t.title}」의 고정 시간이 마감일 이후입니다.`);
    if (end <= now.getTime())
      warnings.add(
        `「${t.title}」의 고정 시간이 지났습니다. 완료하거나 시간을 바꿔 주세요.`,
      );
    blocked.push([start, end + breakMinutes * minute]);
    t.reason =
      t.origin === "calendar" && !t.userEdited
        ? "캘린더에서 정한 학습 시간을 유지했어요"
        : "직접 지정한 시간을 유지했어요";
  }
  const candidates = pending.filter((t) => !pinned.includes(t));
  const urgency = (t: Task) => {
    const g = t.goalId ? goals.get(t.goalId) : undefined;
    const due = effectiveDeadline(t);
    const remaining = g
      ? Math.max(
          0,
          g.totalMinutes -
            state.tasks
              .filter((q) => q.goalId === g.id && q.status === "completed")
              .reduce((s, q) => s + q.estimatedMinutes, 0),
        )
      : t.estimatedMinutes;
    return (
      (due
        ? 1000 / Math.max(1, dayDistance(today, due) + 1) +
          (remaining / (Math.max(1, dayDistance(today, due) + 1) * budget)) * 20
        : 0) +
      Math.min(t.postponements, 5) * 5
    );
  };
  candidates.sort(
    (a, b) =>
      urgency(b) - urgency(a) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  // A task scheduled yesterday is still the same task. Never regenerate or discard it.
  for (const t of candidates) {
    t.scheduledStart = undefined;
    t.scheduledEnd = undefined;
    t.reason = undefined;
  }
  let todayAvailable = 0;
  for (let day = 0; day < horizon; day++) {
    const key = addDays(today, day);
    const start = Math.max(
      zonedInstant(key, dayStart, timeZone).getTime(),
      Math.ceil(now.getTime() / (5 * minute)) * 5 * minute,
    );
    const end = zonedInstant(key, dayEnd, timeZone).getTime();
    if (start >= end) continue;
    let slots = subtractIntervals([start, end], blocked);
    const pinnedMinutes = pinned
      .filter((t) => dateKey(t.scheduledStart!, timeZone) === key)
      .reduce(
        (s, t) =>
          s +
          (Date.parse(t.scheduledEnd!) - Date.parse(t.scheduledStart!)) /
            minute,
        0,
      );
    const completedMinutes = state.tasks
      .filter(
        (t) =>
          t.status === "completed" &&
          t.completedAt &&
          dateKey(t.completedAt, timeZone) === key,
      )
      .reduce((s, t) => s + (t.actualMinutes ?? t.estimatedMinutes), 0);
    let left = Math.max(0, budget - pinnedMinutes - completedMinutes);
    if (!day)
      todayAvailable = Math.min(
        left,
        slots.reduce((s, [a, b]) => s + (b - a) / minute, 0),
      );
    for (const t of candidates) {
      if (t.scheduledStart || (t.notBefore && t.notBefore > key)) continue;
      const deadline = effectiveDeadline(t);
      if (deadline && key > deadline) continue;
      const duration = Math.max(
        5,
        Math.ceil((t.estimatedMinutes * durationFactor) / 5) * 5,
      );
      if (duration > left) continue;
      const index = slots.findIndex(([a, b]) => b - a >= duration * minute);
      if (index < 0) continue;
      const [a, b] = slots[index];
      t.scheduledStart = new Date(a).toISOString();
      t.scheduledEnd = new Date(a + duration * minute).toISOString();
      t.reason = t.postponements
        ? "미룬 퀘스트를 가능한 시간에 다시 배치했어요"
        : deadline
          ? "마감일과 남은 학습량을 고려했어요"
          : "고정 일정 사이의 여유 시간에 배치했어요";
      if (durationFactor > 1.1) t.reason += " · 최근 소요 시간 반영";
      slots.splice(
        index,
        1,
        ...(a + (duration + breakMinutes) * minute < b
          ? [[a + (duration + breakMinutes) * minute, b] as Interval]
          : []),
      );
      left -= duration;
    }
  }
  for (const t of candidates.filter((t) => !t.scheduledStart)) {
    const deadline = effectiveDeadline(t);
    t.reason =
      deadline && deadline < today
        ? "마감일이 지났어요. 목표 날짜를 조정해 주세요"
        : "앞으로 14일 안에 가능한 시간이 부족해요. 학습 시간을 늘리거나 퀘스트를 나눠 주세요";
    if (deadline && deadline <= addDays(today, horizon - 1))
      warnings.add(`「${t.title}」을 마감일까지 배치하지 못했어요.`);
  }
  for (const g of state.goals.filter((g) => !g.archived)) {
    const finished = state.tasks
      .filter((t) => t.goalId === g.id && t.status === "completed")
      .reduce((s, t) => s + t.estimatedMinutes, 0);
    if (
      Math.max(0, g.totalMinutes - finished) * durationFactor >
      Math.max(0, dayDistance(today, g.deadline) + 1) * budget
    )
      warnings.add(
        `「${g.title}」의 남은 학습량에 비해 시간이 부족해요. 범위나 마감일을 조정해 주세요.`,
      );
  }
  if (state.calendarError)
    warnings.add(
      "캘린더를 새로 확인하지 못했어요. 마지막으로 저장한 일정을 사용합니다.",
    );
  const todayTasks = pending.filter(
    (t) => t.scheduledStart && dateKey(t.scheduledStart, timeZone) === today,
  );
  const report: PlanReport = {
    at: now.toISOString(),
    scheduled: todayTasks.length,
    deferred: candidates.filter((t) => !t.scheduledStart).length,
    availableMinutes: Math.round(todayAvailable),
    plannedMinutes: todayTasks.reduce(
      (s, t) =>
        s +
        Math.round(
          (Date.parse(t.scheduledEnd!) - Date.parse(t.scheduledStart!)) /
            minute,
        ),
      0,
    ),
    completionRate,
    durationFactor,
    warnings: [...warnings],
  };
  state.report = report;
  return state;
}
export function statsFor(state: Workspace, now = new Date()) {
  const done = state.tasks.filter((t) => t.status === "completed");
  const xp = state.baseXp + done.reduce((s, t) => s + t.xp, 0);
  const dates = new Set([
    ...state.legacyCompletedDates,
    ...done
      .filter((t) => t.completedAt)
      .map((t) => dateKey(t.completedAt!, state.settings.timeZone)),
  ]);
  let cursor = dateKey(now, state.settings.timeZone),
    streak = 0;
  if (!dates.has(cursor)) cursor = addDays(cursor, -1);
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return {
    xp,
    level: Math.floor(xp / 100) + 1,
    streak,
    completed: done.length,
    minutes: done.reduce(
      (s, t) => s + (t.actualMinutes ?? t.estimatedMinutes),
      0,
    ),
    dates: [...dates],
  };
}
