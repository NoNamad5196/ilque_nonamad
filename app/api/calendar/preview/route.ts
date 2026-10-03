import { errorResponse } from "@/lib/api-response";
import { getApiActor } from "@/lib/auth";
import { getCurrentWeekMission, getTodayCalendarEvents } from "@/lib/calendar";

export async function GET() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  if (!actor.accessToken) {
    return Response.json({
      calendarConnected: false,
      todayEvents: [],
      weeklyMission: null,
    });
  }

  try {
    const [todayEvents, weeklyMission] = await Promise.all([
      getTodayCalendarEvents(actor.accessToken),
      getCurrentWeekMission(actor.accessToken),
    ]);

    return Response.json({
      calendarConnected: true,
      todayEvents,
      weeklyMission,
    });
  } catch {
    return errorResponse(
      "캘린더 연동 상태를 확인하지 못했습니다. 다시 로그인해보세요.",
      500,
    );
  }
}
