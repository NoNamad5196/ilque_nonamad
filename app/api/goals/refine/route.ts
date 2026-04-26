import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { refineGoalPlan } from "@/lib/app-data";
import { goalPlanRefineSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = goalPlanRefineSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("수정 요청과 현재 플랜을 다시 확인해주세요.", parsed.error);
  }

  try {
    const plan = await refineGoalPlan({
      goal: {
        title: parsed.data.title,
        category: parsed.data.category,
        durationLabel: parsed.data.durationLabel,
        durationDays: parsed.data.durationDays,
        dailyHours: parsed.data.dailyHours,
        currentLevel: parsed.data.currentLevel
      },
      plan: parsed.data.plan,
      instruction: parsed.data.instruction
    });

    return Response.json({ plan });
  } catch {
    return errorResponse("플랜 수정 요청을 반영하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
