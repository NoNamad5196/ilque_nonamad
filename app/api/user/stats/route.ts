import { getApiActor } from "@/lib/auth";
import { readWorkspace } from "@/lib/v2/store";
import { statsFor } from "@/lib/v2/scheduler";
export async function GET() {
  const actor = await getApiActor();
  if (!actor)
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    return Response.json({
      stats: statsFor(await readWorkspace(actor.viewer.id)),
    });
  } catch {
    return Response.json(
      { error: "학습 기록을 불러오지 못했어요." },
      { status: 503 },
    );
  }
}
