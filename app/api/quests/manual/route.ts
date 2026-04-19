import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { getApiActor } from "@/lib/auth";
import { createManualQuestPreview } from "@/lib/mock-data";
import { guessCategoryFromText } from "@/lib/utils";
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

  const quest = createManualQuestPreview(parsed.data.title);
  quest.description = parsed.data.description;
  quest.category = parsed.data.category ?? guessCategoryFromText(parsed.data.title);

  return Response.json({ quest });
}
