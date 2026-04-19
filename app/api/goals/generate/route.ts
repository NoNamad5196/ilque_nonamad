import { errorResponse, zodErrorResponse } from "@/lib/api-response";
import { generateGoalPlan } from "@/lib/app-data";
import { goalInputSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return errorResponse("요청 형식이 올바르지 않습니다.", 400);
  }

  const parsed = goalInputSchema.safeParse(body);

  if (!parsed.success) {
    return zodErrorResponse("입력값을 다시 확인해주세요.", parsed.error);
  }

  try {
    const plan = await generateGoalPlan(
      {
        title: parsed.data.title,
        category: parsed.data.category,
        durationLabel: parsed.data.durationLabel,
        durationDays: parsed.data.durationDays,
        dailyHours: parsed.data.dailyHours,
        currentLevel: parsed.data.currentLevel
      },
      parsed.data.persist
    );

    return Response.json({
      plan,
      saved: parsed.data.persist
    });
  } catch {
    return errorResponse("플랜을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
}
