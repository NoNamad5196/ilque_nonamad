import { errorResponse } from "@/lib/api-response";
import { getApiActor } from "@/lib/auth";
import { getTodayCalendarEvents } from "@/lib/calendar";

export async function GET() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const events = await getTodayCalendarEvents(actor.accessToken);
    return Response.json({ events });
  } catch {
    return errorResponse("오늘 일정 정보를 불러오지 못했습니다.", 500);
  }
}
