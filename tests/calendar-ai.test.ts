import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mergeCalendar } from "../lib/v2/calendar-sync";
import { fetchCalendarRange } from "../lib/calendar";
import { emptyWorkspace } from "../lib/v2/model";
import { applyCommand } from "../lib/v2/commands";
import { has } from "../lib/env";
import { decomposeGoal } from "../lib/v2/ai";

const now = new Date("2026-09-11T00:00:00Z");
const event = {
  id: "study-1",
  summary: "SQL 공부",
  start: "2026-09-11T10:00:00+09:00",
  end: "2026-09-11T10:30:00+09:00",
  isAllDay: false,
};
const originalFetch = globalThis.fetch;
const originalAi = has.ai;
afterEach(() => {
  globalThis.fetch = originalFetch;
  has.ai = originalAi;
});
test("학습 일정만 퀘스트로 만들고 자기 자신과 충돌하지 않는다", () => {
  const state = mergeCalendar(
    emptyWorkspace(),
    [
      event,
      {
        ...event,
        id: "meeting",
        summary: "회의",
        start: "2026-09-11T11:00:00+09:00",
        end: "2026-09-11T12:00:00+09:00",
      },
    ],
    now,
  );
  assert.equal(state.tasks.length, 1);
  assert.equal(state.tasks[0].origin, "calendar");
  assert.ok(!state.report?.warnings.some((w) => w.includes("겹칩니다")));
});
test("Calendar 변경과 재동기화는 같은 퀘스트를 갱신한다", () => {
  const state = mergeCalendar(emptyWorkspace(), [event], now);
  const next = mergeCalendar(
    state,
    [
      {
        ...event,
        start: "2026-09-11T13:00:00+09:00",
        end: "2026-09-11T13:30:00+09:00",
      },
    ],
    now,
  );
  assert.equal(next.tasks.length, 1);
  assert.equal(next.tasks[0].id, state.tasks[0].id);
  assert.equal(next.tasks[0].scheduledStart, "2026-09-11T13:00:00+09:00");
});
test("최초 연결은 지난 날짜의 학습 일정을 미완료로 만들지 않는다", () => {
  const state = mergeCalendar(
    emptyWorkspace(),
    [
      {
        ...event,
        start: "2026-09-10T10:00:00+09:00",
        end: "2026-09-10T10:30:00+09:00",
      },
    ],
    now,
  );
  assert.equal(state.tasks.length, 0);
});
test("제목만 바꾼 Calendar 퀘스트도 자신과 충돌하지 않는다", () => {
  const state = mergeCalendar(emptyWorkspace(), [event], now);
  state.tasks[0].title = "새 제목";
  state.tasks[0].userEdited = true;
  const result = mergeCalendar(state, [event], now);
  assert.equal(result.tasks[0].title, "새 제목");
  assert.ok(
    !result.report?.warnings.some((warning) => warning.includes("겹칩니다")),
  );
});
test("취소 후 복원된 Calendar 일정은 동일한 퀘스트로 돌아온다", () => {
  const original = mergeCalendar(emptyWorkspace(), [event], now);
  const removed = mergeCalendar(original, [], now);
  const result = mergeCalendar(removed, [event], now);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].id, original.tasks[0].id);
  assert.equal(result.tasks[0].status, "pending");
});
test("사용자가 미룬 Calendar 퀘스트는 다시 원래 시간으로 돌아가지 않는다", () => {
  let state = mergeCalendar(emptyWorkspace(), [event], now);
  state = applyCommand(
    state,
    { type: "quest.postpone", id: state.tasks[0].id, date: "2026-09-12" },
    now,
  );
  const next = mergeCalendar(state, [event], now);
  assert.equal(next.tasks[0].notBefore, "2026-09-12");
  assert.equal(next.tasks[0].locked, false);
});
test("Calendar 취소는 미완료 자동 퀘스트만 제외한다", () => {
  const state = mergeCalendar(emptyWorkspace(), [event], now);
  const removed = mergeCalendar(state, [], now);
  assert.equal(removed.tasks[0].status, "skipped");
  const done = applyCommand(
    state,
    { type: "quest.complete", id: state.tasks[0].id, actualMinutes: 30 },
    now,
  );
  assert.equal(mergeCalendar(done, [], now).tasks[0].status, "completed");
});
test("주간 미션은 고정 일정을 막지 않고 중복 작업을 만들지 않는다", () => {
  const mission = {
    ...event,
    id: "week",
    summary: "주간 미션",
    description: "- 개념 정리\n- 기출 풀기",
    start: "2026-09-07",
    end: "2026-09-08",
    isAllDay: true,
  };
  const s = mergeCalendar(
    mergeCalendar(emptyWorkspace(), [mission], now),
    [mission],
    now,
  );
  assert.equal(s.calendar.length, 0);
  assert.equal(s.tasks.length, 2);
  assert.equal(s.missions.length, 1);
});
test("Calendar API 페이지, 종일 및 투명 일정 처리", async () => {
  let count = 0;
  globalThis.fetch = (async () => {
    count++;
    return Response.json(
      count === 1
        ? {
            items: [
              {
                id: "1",
                summary: "회의",
                start: { dateTime: event.start },
                end: { dateTime: event.end },
              },
              {
                id: "transparent",
                transparency: "transparent",
                start: { date: "2026-09-11" },
                end: { date: "2026-09-12" },
              },
            ],
            nextPageToken: "second",
          }
        : {
            items: [
              {
                id: "2",
                summary: "휴일",
                start: { date: "2026-09-12" },
                end: { date: "2026-09-13" },
              },
            ],
          },
    );
  }) as typeof fetch;
  const result = await fetchCalendarRange("test-token", "2026-09-11", 3);
  assert.equal(count, 2);
  assert.equal(result.length, 2);
  assert.equal(result[1].isAllDay, true);
});
test("Calendar API 장애를 빈 성공 결과로 숨기지 않는다", async () => {
  globalThis.fetch = (async () =>
    new Response("failed", { status: 503 })) as typeof fetch;
  await assert.rejects(fetchCalendarRange("test-token", "2026-09-11", 1));
});
const goal = {
  id: "g",
  title: "SQL 학습",
  description: "기초",
  category: "sql" as const,
  deadline: "2026-10-01",
  totalMinutes: 300,
  level: "기초",
  createdAt: now.toISOString(),
  archived: false,
};
test("AI 429와 비정상 응답을 저장 가능한 플랜으로 위장하지 않는다", async () => {
  has.ai = true;
  globalThis.fetch = (async () =>
    new Response("quota", { status: 429 })) as typeof fetch;
  await assert.rejects(decomposeGoal(goal, [], ""), /한도/);
  globalThis.fetch = (async () =>
    Response.json({
      candidates: [{ content: { parts: [{ text: "{broken" }] } }],
    })) as typeof fetch;
  await assert.rejects(decomposeGoal(goal, [], ""), /형식/);
});
test("AI는 검증된 작업만 반환하고 날짜와 XP를 무시한다", async () => {
  has.ai = true;
  globalThis.fetch = (async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "계획",
                  tasks: [
                    {
                      title: "개념 정리",
                      estimatedMinutes: 30,
                      xp: 9999,
                      scheduledStart: "yesterday",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    })) as typeof fetch;
  const plan = await decomposeGoal(goal, [], "");
  assert.deepEqual(Object.keys(plan.tasks[0]).sort(), [
    "description",
    "estimatedMinutes",
    "title",
  ]);
});
