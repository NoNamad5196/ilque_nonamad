import { type CalendarEvent, type WeeklyMission } from "@/lib/types";

const calendarBaseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface GoogleCalendarResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    description?: string;
    start?: {
      date?: string;
      dateTime?: string;
    };
    end?: {
      date?: string;
      dateTime?: string;
    };
  }>;
}

type GoogleCalendarItem = NonNullable<GoogleCalendarResponse["items"]>[number];

export function isWeeklyMissionEvent(event: Pick<CalendarEvent, "summary" | "description">) {
  const title = event.summary.trim();
  const source = `${title} ${event.description ?? ""}`.toLowerCase();

  return (
    /^w\d+\b/i.test(title) ||
    title.includes("주간 미션") ||
    title.includes("주간미션") ||
    source.includes("weekly mission") ||
    source.includes("#weekly")
  );
}

function toCalendarEvent(item: GoogleCalendarItem): CalendarEvent | null {
  const start = item.start?.dateTime ?? item.start?.date;
  const end = item.end?.dateTime ?? item.end?.date;

  if (!item.id || !item.summary || !start || !end) {
    return null;
  }

  return {
    id: item.id,
    summary: item.summary,
    description: item.description,
    start,
    end,
    isAllDay: Boolean(item.start?.date)
  };
}

async function fetchCalendarEvents(accessToken: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax
  });

  const response = await fetch(`${calendarBaseUrl}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Google Calendar events request failed.");
  }

  const payload = (await response.json()) as GoogleCalendarResponse;

  return (payload.items ?? []).map(toCalendarEvent).filter(Boolean) as CalendarEvent[];
}

export async function getTodayCalendarEvents(accessToken?: string, now = new Date()) {
  if (!accessToken) {
    return [];
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const events = await fetchCalendarEvents(accessToken, start.toISOString(), end.toISOString());

  return events.filter((event) => !isWeeklyMissionEvent(event));
}

export async function getCurrentWeekMission(
  accessToken?: string,
  now = new Date()
): Promise<WeeklyMission | null> {
  if (!accessToken) {
    return null;
  }

  const start = new Date(now);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const events = await fetchCalendarEvents(accessToken, start.toISOString(), end.toISOString());
  const missionEvent = events.find(isWeeklyMissionEvent);

  if (!missionEvent) {
    return null;
  }

  return {
    title: missionEvent.summary,
    description:
      missionEvent.description ??
      "이번 주 목표를 이벤트 설명에 적어두면 오늘의 퀘스트 추출 품질이 좋아집니다.",
    weekLabel: "이번 주 캘린더 미션"
  };
}
