import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { createManualQuestForActor } from "@/lib/app-data";
import { getApiActor } from "@/lib/auth";
import { manualQuestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = manualQuestSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("퀘스트 이름을 입력해주세요.", parsed.error);
  }

  try {
    const quest = await createManualQuestForActor(parsed.data);

    if (!quest) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    return Response.json({ quest });
  } catch {
    return errorResponse("수동 퀘스트를 저장하지 못했습니다. Supabase 설정과 테이블을 확인해주세요.", 500);
  }
}
