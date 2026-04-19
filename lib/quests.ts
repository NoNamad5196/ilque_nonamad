import { type CalendarEvent, type Quest, type UserStats, type WeeklyMission } from "@/lib/types";
import { QUEST_XP, getLevelFromXp, guessCategoryFromText, stableId, toIsoDate } from "@/lib/utils";

export function createDailyQuests(input: {
  todayEvents: CalendarEvent[];
  weeklyMission: WeeklyMission | null;
  now?: Date;
}): Quest[] {
  if (input.todayEvents.length > 0) {
    return input.todayEvents.map((event) => {
      const category = guessCategoryFromText(`${event.summary} ${event.description ?? ""}`);

      return {
        id: stableId(event.id, event.summary),
        title: event.summary,
        description:
          event.description ??
          "캘린더 이벤트를 오늘의 학습 퀘스트로 변환했습니다. 끝나면 탭해서 XP를 적립하세요.",
        category,
        startTime: event.start,
        endTime: event.end,
        xp: QUEST_XP[category],
        completed: false,
        source: "calendar"
      };
    });
  }

  if (input.weeklyMission) {
    const weeklyMission = input.weeklyMission;
    const tasks = weeklyMission.description
      .split(/\r?\n|,|·/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    return tasks.map((task, index) => {
      const category = guessCategoryFromText(task);
      const base = input.now ?? new Date();
      const start = new Date(base);
      start.setHours(19 + index, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 50);

      return {
        id: stableId(weeklyMission.title, task),
        title: task,
        description: `${weeklyMission.title}에서 오늘치로 추출한 퀘스트입니다.`,
        category,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        xp: QUEST_XP[category],
        completed: false,
        source: "weekly-mission"
      };
    });
  }

  return [];
}

export function completeQuestLocally(stats: UserStats, quest: Quest) {
  const alreadyCompletedToday = stats.lastCompletedDate === toIsoDate(new Date());
  const xp = stats.xp + quest.xp;

  return {
    xp,
    level: getLevelFromXp(xp),
    streak: alreadyCompletedToday ? stats.streak : stats.streak + 1,
    lastCompletedDate: toIsoDate(new Date())
  };
}
