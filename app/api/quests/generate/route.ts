import { errorResponse } from "@/lib/api-response";
import { generateQuestPlanWithAi } from "@/lib/ai/gemini";
import { getPendingManualQuests } from "@/lib/app-data";
import { getApiActor } from "@/lib/auth";
import { getCurrentWeekMission, getTodayCalendarEvents } from "@/lib/calendar";

export async function POST() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const [todayEvents, weeklyMission, manualQuests] = await Promise.all([
      getTodayCalendarEvents(actor.accessToken),
      getCurrentWeekMission(actor.accessToken),
      getPendingManualQuests(actor.viewer.id)
    ]);

    const generatedQuests = await generateQuestPlanWithAi({
      todayEvents,
      weeklyMission
    });

    return Response.json({ quests: [...manualQuests, ...generatedQuests] });
  } catch {
    return errorResponse("오늘의 퀘스트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
