import { errorResponse } from "@/lib/api-response";
import { deleteManualQuestForActor } from "@/lib/app-data";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return errorResponse("삭제할 퀘스트를 찾지 못했습니다.", 400);
  }

  try {
    const deleted = await deleteManualQuestForActor(params.id);

    if (deleted === null) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    if (!deleted) {
      return errorResponse("이미 삭제되었거나 찾을 수 없는 퀘스트입니다.", 404);
    }

    return Response.json({ ok: true });
  } catch {
    return errorResponse("퀘스트를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
