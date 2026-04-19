import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { completeQuestForActor } from "@/lib/app-data";
import { questSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = questSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("퀘스트 정보를 다시 확인해주세요.", parsed.error);
  }

  const stats = await completeQuestForActor({
    ...parsed.data,
    completed: true
  }).catch(() => null);

  if (!stats) {
    return errorResponse("퀘스트 완료 처리에 실패했습니다. 다시 시도해주세요.", 401);
  }

  return Response.json({ stats });
}
