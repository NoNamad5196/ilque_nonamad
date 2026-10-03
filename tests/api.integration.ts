import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { encode } from "next-auth/jwt";
import { type Workspace } from "../lib/v2/model";
import { dateKey, addDays } from "../lib/v2/time";

loadEnvConfig(process.cwd());
const base = process.env.ILQUE_TEST_URL || "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
  throw new Error("통합 테스트는 로컬 서버에서만 실행합니다.");

test("로컬 HTTP: 인증, 소유권, 저장, 완료, 동시 수정, 실패 처리", async (t) => {
  const user = `ilque-test-${randomUUID()}`,
    other = `ilque-test-${randomUUID()}`;
  const cookie = `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { sub: user, name: "로컬 검증 계정", email: "qa@example.invalid" }, maxAge: 600 })}`;
  const otherCookie = `next-auth.session-token=${await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { sub: other, name: "독립 검증 계정", email: "other@example.invalid" }, maxAge: 600 })}`;
  const call = async (command?: unknown, revision = 0, auth = cookie) => {
    const response = await fetch(`${base}/api/v2`, {
      method: command ? "POST" : "GET",
      headers: {
        Cookie: auth,
        ...(command
          ? { "Content-Type": "application/json", Origin: base }
          : {}),
      },
      ...(command ? { body: JSON.stringify({ revision, command }) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  let state: Workspace;
  try {
    await t.test("미인증 API와 위조 토큰 차단", async () => {
      assert.equal((await call(undefined, 0, "")).status, 401);
      assert.equal(
        (await call(undefined, 0, "next-auth.session-token=forged")).status,
        401,
      );
    });
    await t.test("테스트 계정 세션 확인 및 비밀 비노출", async () => {
      const r = await fetch(`${base}/api/auth/session`, {
        headers: { Cookie: cookie },
      });
      const s = await r.json();
      assert.equal(s.user.id, user);
      assert.equal(s.accessToken, undefined);
      assert.equal(s.refreshToken, undefined);
    });
    await t.test("서버 파일 저장 모드 및 새 데이터 로딩", async () => {
      const r = await call();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(
        r.body.config.storage,
        "file",
        "테스트 전 npm run dev:local로 시작해 주세요.",
      );
      state = r.body.state;
    });
    await t.test("목표 생성", async () => {
      const r = await call(
        {
          type: "goal.save",
          data: {
            title: "로컬 검증 목표",
            description: "테스트 전용",
            category: "coding",
            deadline: addDays(dateKey(new Date()), 14),
            totalMinutes: 300,
          },
        },
        state.revision,
      );
      assert.equal(r.status, 200);
      state = r.body.state;
      assert.equal(state.goals.length, 1);
    });
    await t.test("퀘스트 추가와 저장 후 재조회", async () => {
      const r = await call(
        {
          type: "quest.save",
          data: {
            title: "통합 테스트 퀘스트",
            category: "coding",
            estimatedMinutes: 30,
            goalId: state.goals[0].id,
            xp: 99999,
          },
        },
        state.revision,
      );
      assert.equal(r.status, 200);
      state = r.body.state;
      assert.equal(state.tasks[0].xp, 20);
      const read = await call();
      assert.deepEqual(read.body.state, state);
    });
    await t.test("다른 계정에는 데이터가 보이지 않는다", async () => {
      const r = await call(undefined, 0, otherCookie);
      assert.equal(r.body.state.tasks.length, 0);
      assert.equal(r.body.state.goals.length, 0);
    });
    await t.test("타인 퀘스트 완료를 거부한다", async () => {
      const r = await call(
        { type: "quest.complete", id: state.tasks[0].id, actualMinutes: 30 },
        0,
        otherCookie,
      );
      assert.equal(r.status, 404);
    });
    await t.test("동시에 같은 버전을 쓰면 한 요청만 성공한다", async () => {
      const command = {
        type: "quest.complete",
        id: state.tasks[0].id,
        actualMinutes: 45,
      };
      const results = await Promise.all([
        call(command, state.revision),
        call(command, state.revision),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      state = (await call()).body.state;
      assert.equal(state.tasks[0].status, "completed");
      assert.equal(
        state.activities.filter((a) => a.action === "quest.complete").length,
        1,
      );
    });
    await t.test(
      "중복 완료 재요청에도 기록과 보상이 중복되지 않는다",
      async () => {
        const r = await call(
          { type: "quest.complete", id: state.tasks[0].id, actualMinutes: 45 },
          state.revision,
        );
        state = r.body.state;
        assert.equal(
          state.activities.filter((a) => a.action === "quest.complete").length,
          1,
        );
      },
    );
    await t.test("완료 취소·수정·미루기·재배치", async () => {
      let r = await call(
        { type: "quest.undo", id: state.tasks[0].id },
        state.revision,
      );
      state = r.body.state;
      r = await call(
        {
          type: "quest.save",
          data: {
            id: state.tasks[0].id,
            title: "수정한 퀘스트",
            category: "review",
            estimatedMinutes: 20,
            goalId: state.goals[0].id,
          },
        },
        state.revision,
      );
      state = r.body.state;
      const tomorrow = addDays(dateKey(new Date()), 1);
      r = await call(
        { type: "quest.postpone", id: state.tasks[0].id, date: tomorrow },
        state.revision,
      );
      state = r.body.state;
      assert.equal(state.tasks[0].notBefore, tomorrow);
      assert.equal(state.tasks[0].title, "수정한 퀘스트");
      assert.equal(state.tasks[0].xp, 15);
    });
    await t.test("자료와 주간 미션 저장", async () => {
      let r = await call(
        {
          type: "source.save",
          data: {
            title: "테스트 자료",
            summary: "개인 계정 자료",
            url: "https://example.com/study",
            goalId: state.goals[0].id,
          },
        },
        state.revision,
      );
      state = r.body.state;
      r = await call(
        { type: "mission.save", title: "이번 주 테스트", target: 3 },
        state.revision,
      );
      state = r.body.state;
      assert.equal(state.sources.length, 1);
      assert.equal(state.missions[0].target, 3);
    });
    await t.test("비정상 입력·교차 출처·Notion 소유권 차단", async () => {
      assert.equal(
        (
          await call(
            {
              type: "quest.save",
              data: { title: "", category: "study", estimatedMinutes: -1 },
            },
            state.revision,
          )
        ).status,
        400,
      );
      const r = await fetch(`${base}/api/v2`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          Origin: "https://attacker.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          revision: state.revision,
          command: { type: "replan" },
        }),
      });
      assert.equal(r.status, 403);
      assert.equal(
        (await call({ type: "notion.import" }, state.revision)).status,
        403,
      );
    });
    await t.test(
      "Calendar 토큰 부재와 잘못된 AI 출력은 저장하지 않는다",
      async () => {
        const before = state.revision;
        assert.equal(
          (await call({ type: "calendar.sync" }, state.revision)).status,
          401,
        );
        assert.equal(
          (
            await call(
              {
                type: "ai.apply",
                goalId: state.goals[0].id,
                plan: { tasks: [] },
              },
              state.revision,
            )
          ).status,
          400,
        );
        assert.equal((await call()).body.state.revision, before);
      },
    );
    await t.test("AI 계획 적용은 중복 작업을 만들지 않는다", async () => {
      const plan = {
        summary: "검증된 예시 응답",
        tasks: [{ title: "API 예시 작업", estimatedMinutes: 30 }],
      };
      let r = await call(
        { type: "ai.apply", goalId: state.goals[0].id, plan },
        state.revision,
      );
      state = r.body.state;
      r = await call(
        { type: "ai.apply", goalId: state.goals[0].id, plan },
        state.revision,
      );
      state = r.body.state;
      assert.equal(
        state.tasks.filter((q) => q.title === "API 예시 작업").length,
        1,
      );
    });
    await t.test("이전 XP 입력 API는 닫혀 있다", async () => {
      const r = await fetch(`${base}/api/quests/complete`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ xp: 999999 }),
      });
      assert.equal(r.status, 410);
    });
    await t.test("실제 디스크에 마지막 버전이 보관된다", async () => {
      const key = createHash("sha256").update(`ilque-v2:${user}`).digest("hex");
      const persisted = JSON.parse(
        await readFile(`.local-data/${key}.json`, "utf8"),
      );
      assert.equal(persisted.revision, state.revision);
      assert.equal(persisted.tasks.length, state.tasks.length);
    });
  } finally {
    // Only disposable records generated by this test; never real user data.
    for (const id of [user, other]) {
      const key = createHash("sha256").update(`ilque-v2:${id}`).digest("hex");
      await rm(`.local-data/${key}.json`, { force: true });
    }
  }
});
