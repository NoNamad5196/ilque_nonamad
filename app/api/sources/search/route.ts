import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { searchWebSourcesWithAi } from "@/lib/ai/gemini";
import { getApiActor } from "@/lib/auth";
import { webSourceSearchSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = webSourceSearchSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("검색어를 다시 확인해주세요.", parsed.error);
  }

  try {
    const result = await searchWebSourcesWithAi(parsed.data.query);

    if (result.results.length === 0) {
      return errorResponse(
        "검색 결과를 찾지 못했습니다. 검색어를 조금 더 구체적으로 입력해보세요.",
        404,
      );
    }

    return Response.json(result);
  } catch {
    return errorResponse(
      "웹 자료 검색에 실패했습니다. Gemini 무료 한도 또는 API 설정을 확인해주세요.",
      500,
    );
  }
}
