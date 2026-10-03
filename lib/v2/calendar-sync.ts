import type { CalendarEvent } from "../types";
import { isWeeklyMissionEvent } from "../calendar";
import { guessCategoryFromText, QUEST_XP } from "../utils";
import { type Workspace } from "./model";
import { addDays, dateKey, weekKey } from "./time";
import { scheduleWorkspace } from "./scheduler";

export function mergeCalendar(
  state: Workspace,
  events: CalendarEvent[],
  now = new Date(),
): Workspace {
  const next = structuredClone(state),
    today = dateKey(now, next.settings.timeZone),
    monday = weekKey(today);
  next.calendar = events.filter((e) => !isWeeklyMissionEvent(e));
  const mission = events.find(
    (e) =>
      isWeeklyMissionEvent(e) &&
      weekKey(
        e.isAllDay
          ? e.start.slice(0, 10)
          : dateKey(e.start, next.settings.timeZone),
      ) === monday,
  );
  if (mission) {
    next.missions = [
      ...next.missions.filter((m) => m.week !== monday),
      {
        id: mission.id,
        title: mission.summary,
        target: next.missions.find((m) => m.week === monday)?.target ?? 5,
        week: monday,
      },
    ];
    for (const [i, line] of (mission.description ?? "")
      .split(/\r?\n/)
      .map((s) => s.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 7)
      .entries()) {
      const id = `mission-${mission.id}-${i}`;
      if (!next.tasks.some((t) => t.id === id)) {
        const category = guessCategoryFromText(line);
        next.tasks.push({
          id,
          title: line.slice(0, 200),
          description: mission.summary,
          category,
          origin: "mission",
          estimatedMinutes: 30,
          status: "pending",
          xp: QUEST_XP[category],
          deadline: addDays(monday, 6),
          locked: false,
          postponements: 0,
          createdAt: now.toISOString(),
        });
      }
    }
  }
  for (const event of next.calendar) {
    if (
      event.isAllDay ||
      !/#study|#학습|sql|공부|복습|코테|스터디|자격증|학습|알고리즘/i.test(
        `${event.summary} ${event.description ?? ""}`,
      )
    )
      continue;
    const existing = next.tasks.find((t) => t.calendarEventId === event.id);
    // The first sync should not turn last week's study appointments into missed work.
    if (!existing && dateKey(event.end, next.settings.timeZone) < today)
      continue;
    // Completion and explicit user edits win over external sync.
    if (existing && (existing.status === "completed" || existing.userEdited))
      continue;
    const category = guessCategoryFromText(event.summary);
    const values = {
      title: event.summary,
      description: event.description ?? "캘린더에서 정한 학습 시간이에요.",
      estimatedMinutes: Math.max(
        5,
        Math.min(
          480,
          Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60000),
        ),
      ),
      scheduledStart: event.start,
      scheduledEnd: event.end,
      locked: true,
      category,
    };
    if (existing) {
      if (
        existing.status === "skipped" &&
        existing.reason === "캘린더에서 취소된 일정이에요"
      )
        existing.status = "pending";
      Object.assign(existing, values);
    } else
      next.tasks.push({
        ...values,
        id: `calendar-${event.id}`,
        calendarEventId: event.id,
        origin: "calendar",
        status: "pending",
        xp: QUEST_XP[category],
        postponements: 0,
        createdAt: now.toISOString(),
      });
  }
  for (const task of next.tasks) {
    if (
      task.origin === "calendar" &&
      task.calendarEventId &&
      !task.userEdited &&
      task.status === "pending" &&
      task.scheduledStart &&
      dateKey(task.scheduledStart, next.settings.timeZone) >= monday &&
      dateKey(task.scheduledStart, next.settings.timeZone) <
        addDays(monday, 21) &&
      !next.calendar.some((e) => e.id === task.calendarEventId)
    ) {
      task.status = "skipped";
      task.reason = "캘린더에서 취소된 일정이에요";
    }
  }
  next.calendarSyncedAt = now.toISOString();
  next.calendarRangeEnd = addDays(monday, 21);
  next.calendarError = undefined;
  next.activities.unshift({
    id: crypto.randomUUID(),
    title: "캘린더 일정과 주간 미션을 동기화했어요",
    action: "calendar.sync",
    at: now.toISOString(),
  });
  return scheduleWorkspace(next, now);
}
