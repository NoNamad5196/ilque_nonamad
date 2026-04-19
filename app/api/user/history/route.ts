import { errorResponse } from "@/lib/api-response";
import { getHistoryEntries } from "@/lib/app-data";
import { getApiActor } from "@/lib/auth";

export async function GET() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const history = await getHistoryEntries(actor.viewer.id);
    return Response.json({ history });
  } catch {
    return errorResponse("완료 기록을 불러오지 못했습니다.", 500);
  }
}
