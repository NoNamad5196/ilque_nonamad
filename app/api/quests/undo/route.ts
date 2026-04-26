import { z } from "zod";

import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { undoQuestCompletionForActor } from "@/lib/app-data";
import { questSchema } from "@/lib/validators";

const undoQuestSchema = z.object({
  completionId: z.string().uuid(),
  notionPageId: z.string().optional(),
  quest: questSchema
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = undoQuestSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("실행 취소 정보를 다시 확인해주세요.", parsed.error);
  }

  try {
    const stats = await undoQuestCompletionForActor(parsed.data);

    if (!stats) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    return Response.json({ stats });
  } catch {
    return errorResponse("완료 처리를 되돌리지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
