import { errorResponse } from "@/lib/api-response";
import { getUserStats } from "@/lib/app-data";
import { getApiActor } from "@/lib/auth";

export async function GET() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const stats = await getUserStats(actor.viewer.id);
    return Response.json({ stats });
  } catch {
    return errorResponse("사용자 통계를 불러오지 못했습니다.", 500);
  }
}
