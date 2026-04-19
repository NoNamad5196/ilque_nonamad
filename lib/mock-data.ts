import { type GoalInput, type GoalPlan, type Quest, type WeeklyProgressDay } from "@/lib/types";
import { getWeekDays, guessCategoryFromText, stableId, toIsoDate } from "@/lib/utils";

export function createMockWeekProgress(now = new Date()): WeeklyProgressDay[] {
  return getWeekDays(now).map((date) => ({
    label: weekdayLabelKorean(date),
    date: toIsoDate(date),
    completed: false,
    isToday: toIsoDate(date) === toIsoDate(now)
  }));
}

function weekdayLabelKorean(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
}

export function createMockGoalPlan(input: GoalInput): GoalPlan {
  const totalWeeks = Math.max(1, Math.ceil(input.durationDays / 7));
  const themes = [
    "기초 개념 다지기",
    "문제 풀이 루틴 만들기",
    "실전 감각 끌어올리기",
    "오답 정리와 빈틈 보완"
  ];

  return {
    summary: `${input.durationLabel} ${input.title} 플랜`,
    advice: `${input.currentLevel} 기준으로 초반 1주차는 개념 정리와 워밍업에 집중하고, 이후에는 반복 풀이와 회고 비중을 점진적으로 높이는 흐름을 추천합니다.`,
    weeks: Array.from({ length: totalWeeks }, (_, index) => ({
      week: index + 1,
      theme: themes[index] ?? `${index + 1}주차 집중 정리`,
      daily: [
        { day: "월", tasks: [`${input.title} 핵심 개념 읽기`, "핵심 키워드 5개 정리"] },
        { day: "화", tasks: ["예제 2개 직접 풀기", "막힌 부분 메모 남기기"] },
        { day: "수", tasks: ["오답 3개 복기", "개념 카드 업데이트"] },
        { day: "목", tasks: ["응용 문제 도전", "설명 가능한지 점검"] },
        { day: "금", tasks: ["짧은 모의 테스트", "취약 파트 표시"] },
        { day: "토", tasks: ["주간 회고", "다음 주 우선순위 조정"] },
        { day: "일", tasks: ["가벼운 복습", "휴식 또는 예비 시간 확보"] }
      ]
    }))
  };
}

export function createManualQuestPreview(title: string): Quest {
  const category = guessCategoryFromText(title);

  return {
    id: stableId("manual", title),
    title,
    description: "직접 입력한 퀘스트입니다.",
    category,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    xp: {
      sql: 10,
      coding: 20,
      review: 15,
      study: 30
    }[category],
    completed: false,
    source: "manual"
  };
}
