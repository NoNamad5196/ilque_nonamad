import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, type Task, type Workspace } from "../lib/v2/model";
import {
  scheduleWorkspace,
  statsFor,
  subtractIntervals,
  performance,
} from "../lib/v2/scheduler";
import { applyCommand, commandSchema } from "../lib/v2/commands";
import { addDays, dateKey, zonedInstant } from "../lib/v2/time";
import { parseDecomposition, decomposeGoal } from "../lib/v2/ai";

const now = new Date("2026-09-11T00:00:00Z"); // 09:00 KST
const at = (clock: string, day = "2026-09-11") =>
  zonedInstant(day, clock, "Asia/Seoul").toISOString();
function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `작업 ${id}`,
    description: "검증",
    category: "study",
    estimatedMinutes: 30,
    status: "pending",
    xp: 30,
    origin: "manual",
    locked: false,
    postponements: 0,
    createdAt: now.toISOString(),
    ...overrides,
  };
}
function setup(tasks: Task[]): Workspace {
  const s = emptyWorkspace();
  s.tasks = tasks;
  s.settings.dayStart = "09:00";
  s.settings.dayEnd = "12:00";
  s.settings.dailyMinutes = 120;
  s.settings.breakMinutes = 10;
  return s;
}
describe("일정 배치", () => {
  it("겹친 고정 일정을 합쳐 빈 구간만 남긴다", () => {
    assert.deepEqual(
      subtractIntervals(
        [0, 100],
        [
          [20, 40],
          [30, 60],
          [70, 90],
        ],
      ),
      [
        [0, 20],
        [60, 70],
        [90, 100],
      ],
    );
  });
  it("캘린더와 퀘스트가 겹치지 않고 휴식 시간을 둔다", () => {
    const s = setup([task("a"), task("b")]);
    s.calendar = [
      {
        id: "event",
        summary: "회의",
        start: at("09:15"),
        end: at("10:00"),
        isAllDay: false,
      },
    ];
    const result = scheduleWorkspace(s, now);
    assert.equal(result.tasks[0].scheduledStart, at("10:00"));
    assert.equal(result.tasks[1].scheduledStart, at("10:40"));
    assert.equal(s.tasks[0].scheduledStart, undefined);
  });
  it("마감일 이후로 자동 배치하지 않는다", () => {
    const s = setup([
      task("a", { estimatedMinutes: 180, deadline: "2026-09-11" }),
    ]);
    const r = scheduleWorkspace(s, now);
    assert.equal(r.tasks[0].scheduledStart, undefined);
    assert.ok(r.report!.warnings.length > 0);
  });
  it("목표 마감일과 남은 작업량이 우선순위에 반영된다", () => {
    const s = setup([
      task("later", { deadline: "2026-10-01" }),
      task("urgent", { deadline: "2026-09-11" }),
    ]);
    const r = scheduleWorkspace(s, now);
    assert.equal(
      r.tasks.find((t) => t.id === "urgent")?.scheduledStart,
      at("09:00"),
    );
  });
  it("목표와 개별 작업 중 더 이른 마감일을 지킨다", () => {
    for (const [goalDeadline, taskDeadline] of [
      ["2026-09-20", "2026-09-10"],
      ["2026-09-10", "2026-09-20"],
    ]) {
      const s = setup([task("early", { goalId: "g", deadline: taskDeadline })]);
      s.goals = [
        {
          id: "g",
          title: "목표",
          description: "",
          category: "study",
          deadline: goalDeadline,
          totalMinutes: 30,
          level: "기초",
          createdAt: now.toISOString(),
          archived: false,
        },
      ];
      const result = scheduleWorkspace(s, now);
      assert.equal(result.tasks[0].scheduledStart, undefined);
      assert.ok(
        result.report?.warnings.some((warning) => warning.includes("마감일")),
      );
    }
  });
  it("종일 일정은 사용자의 자정부터 막는다", () => {
    const s = setup([task("a")]);
    s.calendar = [
      {
        id: "off",
        summary: "휴가",
        start: "2026-09-11",
        end: "2026-09-12",
        isAllDay: true,
      },
    ];
    const r = scheduleWorkspace(s, now);
    assert.equal(dateKey(r.tasks[0].scheduledStart!), "2026-09-12");
  });
  it("수동 고정 시간은 보존하고 충돌을 알린다", () => {
    const s = setup([
      task("a", {
        locked: true,
        scheduledStart: at("09:00"),
        scheduledEnd: at("09:30"),
      }),
      task("b"),
    ]);
    s.calendar = [
      {
        id: "event",
        summary: "회의",
        start: at("09:00"),
        end: at("10:00"),
        isAllDay: false,
      },
    ];
    const r = scheduleWorkspace(s, now);
    assert.equal(r.tasks[0].scheduledStart, at("09:00"));
    assert.equal(r.tasks[1].scheduledStart, at("10:00"));
    assert.ok(r.report!.warnings.some((w) => w.includes("겹칩니다")));
  });
  it("오늘 완료한 실제 시간만큼 남은 예산을 차감한다", () => {
    const s = setup([
      task("done", {
        status: "completed",
        completedAt: now.toISOString(),
        actualMinutes: 110,
      }),
      task("a"),
    ]);
    const r = scheduleWorkspace(s, now);
    assert.equal(dateKey(r.tasks[1].scheduledStart!), "2026-09-12");
  });
  it("실측 시간이 예상보다 길거나 짧으면 배치 길이를 보정한다", () => {
    for (const [actual, expected] of [
      [60, 55],
      [15, 20],
    ]) {
      const s = setup([
        task("done", {
          status: "completed",
          completedAt: at("10:00", "2026-09-10"),
          actualMinutes: actual,
        }),
        task("a"),
      ]);
      const r = scheduleWorkspace(s, now);
      assert.equal(
        (Date.parse(r.tasks[1].scheduledEnd!) -
          Date.parse(r.tasks[1].scheduledStart!)) /
          60000,
        expected,
      );
    }
  });
  it("미완료 이월은 같은 ID로 유지하고 한 번만 기록한다", () => {
    const s = setup([
      task("a", {
        scheduledStart: at("09:00", "2026-09-10"),
        scheduledEnd: at("09:30", "2026-09-10"),
      }),
    ]);
    const r = scheduleWorkspace(scheduleWorkspace(s, now), now);
    assert.equal(r.tasks[0].id, "a");
    assert.equal(
      r.activities.filter((a) => a.action === "quest.missed").length,
      1,
    );
  });
  it("최근 낮은 완료율은 재조정 뒤에도 보수적 예산을 유지한다", () => {
    const s = setup([task("a"), task("b"), task("c")]);
    s.activities = [1, 2, 3].map((n) => ({
      id: String(n),
      title: "미루기",
      action: "quest.postpone",
      at: now.toISOString(),
    }));
    const r = scheduleWorkspace(s, now);
    assert.equal(performance(r, now).completionRate, 0);
    assert.equal(r.report?.plannedMinutes, 60);
  });
  it("같은 입력은 같은 계획을 만들고 사용자의 계획을 변경하지 않는다", () => {
    const s = setup([task("b"), task("a")]);
    assert.deepEqual(scheduleWorkspace(s, now), scheduleWorkspace(s, now));
  });
  it("지난 마감과 보관한 목표를 무시하지 않는다", () => {
    const s = setup([task("late", { deadline: "2026-09-10" })]);
    const r = scheduleWorkspace(s, now);
    assert.ok(r.tasks[0].reason?.includes("마감일"));
    assert.equal(r.tasks[0].scheduledStart, undefined);
  });
});
describe("완료·미루기·수정", () => {
  it("중복 완료는 경험치를 추가하지 않는다", () => {
    const s = setup([task("a")]);
    const one = applyCommand(
      s,
      { type: "quest.complete", id: "a", actualMinutes: 20 },
      now,
    );
    const two = applyCommand(
      one,
      { type: "quest.complete", id: "a", actualMinutes: 20 },
      now,
    );
    assert.equal(statsFor(two, now).xp, 30);
    assert.equal(two.activities.length, 1);
  });
  it("완료 취소 후 재완료도 정확한 XP를 유지한다", () => {
    let s = applyCommand(
      setup([task("a")]),
      { type: "quest.complete", id: "a", actualMinutes: 20 },
      now,
    );
    s = applyCommand(s, { type: "quest.undo", id: "a" }, now);
    assert.equal(statsFor(s, now).xp, 0);
    s = applyCommand(
      s,
      { type: "quest.complete", id: "a", actualMinutes: 10 },
      now,
    );
    assert.equal(statsFor(s, now).xp, 30);
  });
  it("미루기는 지정 날짜 전에는 배치하지 않는다", () => {
    const s = applyCommand(
      setup([task("a")]),
      { type: "quest.postpone", id: "a", date: "2026-09-14" },
      now,
    );
    assert.equal(dateKey(s.tasks[0].scheduledStart!), "2026-09-14");
    assert.equal(s.tasks[0].postponements, 1);
  });
  it("오늘로 미루기와 타인/없는 퀘스트 접근을 거부한다", () => {
    assert.throws(() =>
      applyCommand(
        setup([task("a")]),
        { type: "quest.postpone", id: "a", date: "2026-09-11" },
        now,
      ),
    );
    assert.throws(() =>
      applyCommand(
        setup([]),
        { type: "quest.complete", id: "not-owned", actualMinutes: 30 },
        now,
      ),
    );
  });
  it("클라이언트 XP를 입력으로 받아들이지 않는다", () => {
    const c = commandSchema.parse({
      type: "quest.save",
      data: {
        title: "복습하기",
        category: "review",
        estimatedMinutes: 30,
        xp: 99999,
      },
    });
    const s = applyCommand(setup([]), c, now);
    assert.equal(s.tasks[0].xp, 15);
  });
  it("목표 수정 후 마감일을 넘는 기존 자동 일정을 재검토한다", () => {
    const s = setup([task("a", { goalId: "g", estimatedMinutes: 180 })]);
    s.goals = [
      {
        id: "g",
        title: "목표",
        description: "",
        category: "study",
        deadline: "2026-10-01",
        totalMinutes: 180,
        level: "기초",
        createdAt: now.toISOString(),
        archived: false,
      },
    ];
    const r = applyCommand(
      s,
      { type: "goal.save", data: { ...s.goals[0], deadline: "2026-09-11" } },
      now,
    );
    assert.equal(r.tasks[0].scheduledStart, undefined);
    assert.ok(r.report!.warnings.length);
  });
  it("제외와 복구는 XP를 만들지 않는다", () => {
    const s = applyCommand(
      setup([task("a")]),
      { type: "quest.skip", id: "a" },
      now,
    );
    assert.equal(statsFor(s, now).xp, 0);
    const r = applyCommand(s, { type: "quest.restore", id: "a" }, now);
    assert.equal(r.tasks[0].status, "pending");
  });
});
describe("시간대·스트릭·입력 경계", () => {
  it("한국 자정은 전날 UTC 15시다", () => {
    assert.equal(at("00:00"), "2026-09-10T15:00:00.000Z");
    assert.equal(dateKey("2026-09-10T15:01:00Z"), "2026-09-11");
  });
  it("DST 전환일을 23시간/25시간으로 처리한다", () => {
    const zone = "America/New_York";
    assert.equal(
      (+zonedInstant("2026-03-09", "00:00", zone) -
        +zonedInstant("2026-03-08", "00:00", zone)) /
        3600000,
      23,
    );
    assert.equal(
      (+zonedInstant("2026-11-02", "00:00", zone) -
        +zonedInstant("2026-11-01", "00:00", zone)) /
        3600000,
      25,
    );
  });
  it("지난 스트릭은 자동으로 만료된다", () => {
    const s = setup([
      task("a", {
        status: "completed",
        completedAt: at("20:00", "2026-09-09"),
      }),
    ]);
    assert.equal(statsFor(s, now).streak, 0);
    s.tasks[0].completedAt = at("20:00", "2026-09-10");
    assert.equal(statsFor(s, now).streak, 1);
  });
  it("존재하지 않는 날짜·URL·시간 설정을 거부한다", () => {
    assert.equal(
      commandSchema.safeParse({
        type: "quest.postpone",
        id: "a",
        date: "2026-02-30",
      }).success,
      false,
    );
    assert.equal(
      commandSchema.safeParse({
        type: "source.save",
        data: { title: "링크", url: "javascript:alert(1)" },
      }).success,
      false,
    );
    assert.equal(
      commandSchema.safeParse({
        type: "settings.save",
        data: {
          timeZone: "invalid",
          dayStart: "22:00",
          dayEnd: "09:00",
          dailyMinutes: 120,
          breakMinutes: 10,
        },
      }).success,
      false,
    );
  });
});
describe("AI 응답 검증", () => {
  it("코드 펜스를 제거하되 실제 스키마를 검증한다", () => {
    assert.equal(
      parseDecomposition(
        '```json\n{"summary":"계획","tasks":[{"title":"핵심 개념 정리","estimatedMinutes":30}]}\n```',
      ).tasks.length,
      1,
    );
  });
  it("잘못된 JSON, 빈 작업, 비정상 시간, 과도한 작업 수를 거부한다", () => {
    for (const raw of [
      "not JSON",
      "{}",
      '{"summary":"계획","tasks":[]}',
      JSON.stringify({
        summary: "계획",
        tasks: [{ title: "작업", estimatedMinutes: -10 }],
      }),
      JSON.stringify({
        summary: "계획",
        tasks: Array(31).fill({ title: "작업", estimatedMinutes: 30 }),
      }),
    ])
      assert.throws(() => parseDecomposition(raw));
  });
});
