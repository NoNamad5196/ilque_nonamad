import { errorResponse } from "@/lib/api-response";
import { generateSourceQuestPlanWithAi } from "@/lib/ai/gemini";
import { getApiActor } from "@/lib/auth";
import { getNotionSources } from "@/lib/notion/records";

export async function POST() {
  const actor = await getApiActor();

  if (!actor) {
    return errorResponse("로그인이 필요합니다.", 401);
  }

  try {
    const sources = await getNotionSources(8);

    if (sources.length === 0) {
      return errorResponse("Notion Sources에 읽을 자료가 없습니다. 먼저 Source 항목을 하나 추가해주세요.", 404);
    }

    const quests = await generateSourceQuestPlanWithAi({ sources });

    if (quests.length === 0) {
      return errorResponse("자료에서 만들 수 있는 퀘스트를 찾지 못했습니다.", 422);
    }

    return Response.json({
      sources,
      quests
    });
  } catch {
    return errorResponse("Notion Sources 기반 퀘스트를 생성하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
