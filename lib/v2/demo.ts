import { emptyWorkspace, type Task } from "./model";
import { addDays, dateKey, weekKey, zonedInstant } from "./time";
import { scheduleWorkspace } from "./scheduler";
export function demoWorkspace(now = new Date()) {
  const state = emptyWorkspace(),
    today = dateKey(now),
    createdAt = now.toISOString();
  state.settings.dayStart = "08:00";
  state.settings.dayEnd = "23:55";
  state.settings.dailyMinutes = 180;
  state.goals = [
    {
      id: "demo-goal-sql",
      title: "SQLD, 개념부터 실전까지",
      description: "핵심 개념을 이해하고 기출 문제를 스스로 풀 수 있기",
      category: "sql",
      deadline: addDays(today, 21),
      totalMinutes: 1200,
      level: "기초 있음",
      createdAt,
      archived: false,
    },
    {
      id: "demo-goal-code",
      title: "매일 한 문제, 코딩 감각 기르기",
      description: "자료구조와 알고리즘 문제 풀이",
      category: "coding",
      deadline: addDays(today, 30),
      totalMinutes: 1800,
      level: "기초 있음",
      createdAt,
      archived: false,
    },
  ];
  const base = {
    description: "학습한 내용을 짧게 정리하고 예제에 직접 적용해 보세요.",
    status: "pending" as const,
    origin: "ai" as const,
    locked: false,
    postponements: 0,
    createdAt,
  };
  state.tasks = [
    {
      ...base,
      id: "demo-task-1",
      title: "JOIN의 종류 정리하고 예제 3개 풀기",
      category: "sql",
      goalId: "demo-goal-sql",
      estimatedMinutes: 30,
      xp: 10,
    },
    {
      ...base,
      id: "demo-task-2",
      title: "어제 틀린 SQL 문제 다시 풀기",
      category: "review",
      goalId: "demo-goal-sql",
      estimatedMinutes: 20,
      xp: 15,
    },
    {
      ...base,
      id: "demo-task-3",
      title: "스택으로 괄호 검사 문제 해결하기",
      category: "coding",
      goalId: "demo-goal-code",
      estimatedMinutes: 40,
      xp: 20,
    },
    ...Array.from({ length: 3 }, (_, i) => ({
      ...base,
      id: `demo-done-${i}`,
      title: [
        "관계형 데이터베이스 개념 정리",
        "SELECT 기본 문법 연습",
        "배열 탐색 문제 풀이",
      ][i],
      category: "study" as const,
      goalId: "demo-goal-sql",
      estimatedMinutes: 30,
      actualMinutes: 30,
      status: "completed" as const,
      xp: 30,
      completedAt: zonedInstant(
        addDays(today, -i - 1),
        "20:00",
        "Asia/Seoul",
      ).toISOString(),
    })),
  ] as Task[];
  state.baseXp = 150;
  state.sources = [
    {
      id: "demo-source",
      title: "SQL 학습 노트",
      summary:
        "JOIN, 집계 함수와 서브쿼리. 예제를 실행하며 이해한 내용을 기록해 보세요.",
      url: "https://www.postgresql.org/docs/current/tutorial.html",
      goalId: "demo-goal-sql",
      origin: "manual",
    },
  ];
  state.missions = [
    {
      id: "demo-mission",
      title: "작게 시작해도, 이번 주는 꾸준하게",
      target: 7,
      week: weekKey(today),
    },
  ];
  state.calendar = [
    {
      id: "demo-calendar",
      summary: "저녁 약속",
      start: zonedInstant(today, "18:00", "Asia/Seoul").toISOString(),
      end: zonedInstant(today, "19:00", "Asia/Seoul").toISOString(),
      isAllDay: false,
    },
  ];
  state.calendarSyncedAt = createdAt;
  state.activities = state.tasks
    .filter((t) => t.completedAt)
    .map((t) => ({
      id: t.id,
      taskId: t.id,
      title: `퀘스트 완료 · ${t.title}`,
      action: "quest.complete",
      at: t.completedAt!,
      minutes: t.actualMinutes,
      xp: t.xp,
    }));
  return scheduleWorkspace(state, now);
}
