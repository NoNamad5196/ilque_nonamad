import { getApiActor } from "../auth";
/** V1 writes accepted client-supplied XP and bypassed the V2 atomic state.
 * Fail closed for stale clients instead of keeping an unsafe second writer. */
export async function retiredApi() {
  const actor = await getApiActor();
  return Response.json(
    {
      error: actor
        ? "이전 버전의 요청입니다. 화면을 새로고침한 뒤 다시 이용해 주세요."
        : "로그인이 필요합니다.",
    },
    { status: actor ? 410 : 401 },
  );
}
