import { type CalendarEvent, type WeeklyMission } from "./types";
import { addDays, dateKey, weekKey, zonedInstant } from "./v2/time";

const calendarBaseUrl =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export function isWeeklyMissionEvent(
  event: Pick<CalendarEvent, "summary" | "description">,
) {
  const title = event.summary.trim(),
    text = `${title} ${event.description ?? ""}`.toLowerCase();
  return (
    /^w\d+\b/i.test(title) ||
    title.includes("주간 미션") ||
    title.includes("주간미션") ||
    text.includes("weekly mission") ||
    text.includes("#weekly")
  );
}
export async function fetchCalendarRange(
  accessToken: string,
  firstDay: string,
  days: number,
  timeZone = "Asia/Seoul",
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: zonedInstant(firstDay, "00:00", timeZone).toISOString(),
    timeMax: zonedInstant(
      addDays(firstDay, days),
      "00:00",
      timeZone,
    ).toISOString(),
    timeZone,
    maxResults: "2500",
  });
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${calendarBaseUrl}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Google 로그인을 다시 해주세요."
          : "Google Calendar를 읽지 못했어요.",
      );
    const payload = await response.json();
    for (const item of payload.items ?? []) {
      const start = item.start?.dateTime ?? item.start?.date,
        end = item.end?.dateTime ?? item.end?.date;
      if (
        item.status === "cancelled" ||
        item.transparency === "transparent" ||
        !item.id ||
        !start ||
        !end
      )
        continue;
      events.push({
        id: item.id,
        summary: item.summary || "제목 없는 일정",
        description: item.description,
        start,
        end,
        isAllDay: Boolean(item.start?.date),
      });
    }
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return events;
}
export async function getTodayCalendarEvents(
  accessToken?: string,
  now = new Date(),
) {
  if (!accessToken) return [];
  return (await fetchCalendarRange(accessToken, dateKey(now), 1)).filter(
    (e) => !isWeeklyMissionEvent(e),
  );
}
export async function getCurrentWeekMission(
  accessToken?: string,
  now = new Date(),
): Promise<WeeklyMission | null> {
  if (!accessToken) return null;
  const event = (
    await fetchCalendarRange(accessToken, weekKey(dateKey(now)), 7)
  ).find(isWeeklyMissionEvent);
  return event
    ? {
        title: event.summary,
        description: event.description ?? "이번 주 학습 목표",
        weekLabel: "이번 주 캘린더 미션",
      }
    : null;
}
