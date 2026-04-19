import { errorResponse } from "@/lib/api-response";
import { generateQuestPlanWithAi } from "@/lib/ai/gemma";
import { getApiActor } from "@/lib/auth";
import { getCurrentWeekMission, getTodayCalendarEvents } from "@/lib/calendar";

export async function POST() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const [todayEvents, weeklyMission] = await Promise.all([
      getTodayCalendarEvents(actor.accessToken),
      getCurrentWeekMission(actor.accessToken)
    ]);

    const quests = await generateQuestPlanWithAi({
      todayEvents,
      weeklyMission
    });

    return Response.json({ quests });
  } catch {
    return errorResponse("오늘의 퀘스트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
