import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { getApiActor } from "@/lib/auth";
import { recordWebSourceToNotion } from "@/lib/notion/records";
import { webSourceSaveSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = webSourceSaveSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("저장할 자료 정보를 다시 확인해주세요.", parsed.error);
  }

  try {
    const notionPageId = await recordWebSourceToNotion({
      source: {
        id: `web-source-${parsed.data.url}`,
        title: parsed.data.title,
        url: parsed.data.url,
        summary: parsed.data.summary,
        category: parsed.data.category
      },
      userId: actor.viewer.id
    });

    return Response.json({
      ok: true,
      notionPageId
    });
  } catch {
    return errorResponse("Notion Sources에 자료를 저장하지 못했습니다. Notion 연결을 확인해주세요.", 500);
  }
}
