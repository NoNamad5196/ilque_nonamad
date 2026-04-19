import { errorResponse } from "@/lib/api-response";
import { getApiActor } from "@/lib/auth";
import { getCurrentWeekMission } from "@/lib/calendar";

export async function GET() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const mission = await getCurrentWeekMission(actor.accessToken);

    return Response.json({ mission });
  } catch {
    return errorResponse("주간 미션을 불러오지 못했습니다.", 500);
  }
}
