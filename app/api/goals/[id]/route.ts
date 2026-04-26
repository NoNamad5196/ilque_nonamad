import { errorResponse } from "@/lib/api-response";
import { deleteGoalForActor, updateGoalForActor } from "@/lib/app-data";
import { goalPlanSaveSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return errorResponse("수정할 목표를 찾지 못했습니다.", 400);
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = goalPlanSaveSchema.omit({ persist: true }).safeParse(body);

  if (!parsed.success) {
    return errorResponse("입력값을 다시 확인해주세요.", 400, {
      fieldErrors: parsed.error.flatten().fieldErrors
    });
  }

  try {
    const savedGoal = await updateGoalForActor(
      params.id,
      {
        title: parsed.data.title,
        category: parsed.data.category,
        durationLabel: parsed.data.durationLabel,
        durationDays: parsed.data.durationDays,
        dailyHours: parsed.data.dailyHours,
        currentLevel: parsed.data.currentLevel
      },
      parsed.data.plan
    );

    if (savedGoal === null) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    if (!savedGoal) {
      return errorResponse("이미 삭제되었거나 찾을 수 없는 목표입니다.", 404);
    }

    return Response.json({
      savedGoal,
      plan: savedGoal.plan
    });
  } catch {
    return errorResponse("목표를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!params.id) {
    return errorResponse("삭제할 목표를 찾지 못했습니다.", 400);
  }

  try {
    const deleted = await deleteGoalForActor(params.id);

    if (deleted === null) {
      return errorResponse("로그인이 필요합니다.", 401);
    }

    if (!deleted) {
      return errorResponse("이미 삭제되었거나 찾을 수 없는 목표입니다.", 404);
    }

    return Response.json({ ok: true });
  } catch {
    return errorResponse("목표를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
