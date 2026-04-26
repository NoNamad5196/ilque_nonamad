import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { generateGoalPlan } from "@/lib/app-data";
import { goalPlanSaveSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = goalPlanSaveSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("입력값을 다시 확인해주세요.", parsed.error);
  }

  try {
    const result = await generateGoalPlan(
      {
        title: parsed.data.title,
        category: parsed.data.category,
        durationLabel: parsed.data.durationLabel,
        durationDays: parsed.data.durationDays,
        dailyHours: parsed.data.dailyHours,
        currentLevel: parsed.data.currentLevel
      },
      parsed.data.persist,
      parsed.data.plan
    );

    return Response.json({
      plan: result.plan,
      saved: Boolean(result.savedGoal),
      savedGoal: result.savedGoal
    });
  } catch {
    return errorResponse("플랜을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
