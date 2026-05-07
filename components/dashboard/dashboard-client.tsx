"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { readApiMessage } from "@/lib/api-response";
import { type DashboardSnapshot, type Quest } from "@/lib/types";
import { cn, formatClock, getXpIntoCurrentLevel } from "@/lib/utils";

type Notice = {
  type: "success" | "error" | "info";
  text: string;
};

type UndoState = {
  completionId: string;
  notionPageId?: string;
  quest: Quest;
};

const categoryLabel = {
  sql: "SQL",
  coding: "Coding",
  study: "Study",
  review: "Review"
} as const;

const sourceLabel = {
  calendar: "오늘 일정",
  "weekly-mission": "주간 미션 하위",
  manual: "직접 추가",
  "notion-source": "Notion 자료"
} as const;

export function DashboardClient({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [quests, setQuests] = useState(snapshot.quests);
  const [stats, setStats] = useState(snapshot.stats);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isSyncing, startSync] = useTransition();

  async function handleSync() {
    startSync(async () => {
      setUndoState(null);

      try {
        const response = await fetch("/api/quests/generate", {
          method: "POST"
        });

        if (!response.ok) {
          const message = await readApiMessage(response, "오늘의 퀘스트를 다시 불러오지 못했습니다.");
          setNotice({
            type: "error",
            text: message
          });
          return;
        }

        const payload = (await response.json()) as { quests: Quest[] };
        setQuests(payload.quests);
        setNotice({
          type: "success",
          text: "캘린더 기준으로 오늘의 퀘스트를 다시 불러왔어요."
        });
      } catch {
        setNotice({
          type: "error",
          text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
        });
      }
    });
  }

  async function handleComplete(target: Quest) {
    if (target.completed) {
      return;
    }

    const previousQuests = quests;
    const previousStats = stats;
    const today = new Date().toISOString().slice(0, 10);
    const nextXp = stats.xp + target.xp;

    setUndoState(null);
    setQuests((current) =>
      current.map((quest) => (quest.id === target.id ? { ...quest, completed: true } : quest))
    );
    setStats({
      ...stats,
      xp: nextXp,
      level: Math.floor(nextXp / 100) + 1,
      streak: stats.lastCompletedDate === today ? stats.streak : stats.streak + 1,
      lastCompletedDate: today
    });
    setNotice({
      type: "info",
      text: `"${target.title}" 완료 처리 중입니다.`
    });

    try {
      const response = await fetch("/api/quests/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(target)
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "퀘스트 완료 처리에 실패했습니다.");
        setQuests(previousQuests);
        setStats(previousStats);
        setUndoState(null);
        setNotice({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as {
        stats?: DashboardSnapshot["stats"];
        completionId?: string;
        notionPageId?: string;
      };

      if (payload.stats) {
        setStats(payload.stats);
      }

      if (payload.completionId) {
        setUndoState({
          completionId: payload.completionId,
          notionPageId: payload.notionPageId,
          quest: target
        });
      }

      setNotice({
        type: "success",
        text: `"${target.title}" 완료! XP +${target.xp}`
      });
    } catch {
      setQuests(previousQuests);
      setStats(previousStats);
      setUndoState(null);
      setNotice({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    }
  }

  async function handleUndoComplete() {
    if (!undoState) {
      return;
    }

    const target = undoState.quest;
    const previousQuests = quests;
    const previousStats = stats;
    const previousUndoState = undoState;

    setUndoState(null);
    setQuests((current) =>
      current.map((quest) => (quest.id === target.id ? { ...quest, completed: false } : quest))
    );
    setNotice({
      type: "info",
      text: "완료를 되돌리는 중입니다."
    });

    try {
      const response = await fetch("/api/quests/undo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          completionId: previousUndoState.completionId,
          notionPageId: previousUndoState.notionPageId,
          quest: target
        })
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "완료 취소에 실패했습니다.");
        setQuests(previousQuests);
        setStats(previousStats);
        setNotice({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as { stats?: DashboardSnapshot["stats"] };

      if (payload.stats) {
        setStats(payload.stats);
      }

      setNotice({
        type: "success",
        text: `"${target.title}" 완료를 취소했습니다.`
      });
    } catch {
      setQuests(previousQuests);
      setStats(previousStats);
      setNotice({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    }
  }

  async function handleDeleteManualQuest(target: Quest) {
    if (target.source !== "manual") {
      return;
    }

    const previousQuests = quests;

    setUndoState(null);
    setQuests((current) => current.filter((quest) => quest.id !== target.id));
    setNotice({
      type: "info",
      text: `"${target.title}" 삭제 중입니다.`
    });

    try {
      const response = await fetch(`/api/quests/manual/${target.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "퀘스트 삭제에 실패했습니다.");
        setQuests(previousQuests);
        setNotice({
          type: "error",
          text: message
        });
        return;
      }

      setNotice({
        type: "success",
        text: `"${target.title}" 퀘스트를 삭제했습니다.`
      });
    } catch {
      setQuests(previousQuests);
      setNotice({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    }
  }

  const openQuests = quests.filter((quest) => !quest.completed);
  const completedCount = quests.length - openQuests.length;
  const nextQuest = openQuests[0];
  const progressPercent = quests.length > 0 ? Math.round((completedCount / quests.length) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-slate-500">연속 스트릭</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="section-title text-4xl font-black text-ocean">{stats.streak}</span>
              <span className="pb-1 text-sm text-slate-500">days</span>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-slate-500">누적 XP</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="section-title text-4xl font-black text-ocean">{stats.xp}</span>
              <span className="pb-1 text-sm text-slate-500">xp</span>
            </div>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-sm text-slate-500">현재 레벨</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="section-title text-4xl font-black text-ocean">Lv.{stats.level}</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-ocean/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-coral to-apricot"
                style={{ width: `${getXpIntoCurrentLevel(stats.xp)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">이번 주 진행도</p>
              <h2 className="section-title mt-1 text-2xl font-black text-ocean">주간 스트릭 보드</h2>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-500">
              {snapshot.weekProgress.filter((item) => item.completed).length}/7 완료
            </span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {snapshot.weekProgress.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "rounded-[1.4rem] border px-3 py-4 text-center",
                  day.completed
                    ? "border-transparent bg-gradient-to-br from-coral to-apricot text-white"
                    : "border-ocean/10 bg-white/70 text-slate-500",
                  day.isToday && "ring-2 ring-ocean/20"
                )}
              >
                <p className="text-xs">{day.label}</p>
                <p className="mt-2 text-lg font-bold">{day.completed ? "●" : "○"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500">오늘의 퀘스트</p>
              <h2 className="section-title mt-1 text-2xl font-black text-ocean">오늘 실행할 일일 퀘스트</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-60"
              >
                {isSyncing ? "동기화 중..." : "캘린더 동기화"}
              </button>
              <Link
                href="/onboarding"
                className="rounded-full border border-ocean/10 bg-white px-4 py-2 text-sm font-semibold text-ocean transition hover:bg-white/80"
              >
                퀘스트 직접 추가
              </Link>
            </div>
          </div>

          {snapshot.onboardingState === "needs_setup" ? (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-ocean/20 bg-white/60 p-5">
              <p className="font-semibold text-ocean">캘린더가 비어 있어 온보딩이 필요해요.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                공부 목표와 시작 시간을 먼저 잡고, 캘린더 등록 또는 수동 퀘스트 생성으로 대시보드를 채울 수 있습니다.
              </p>
              <Link
                href="/onboarding"
                className="mt-4 inline-flex rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
              >
                온보딩 시작하기
              </Link>
            </div>
          ) : null}

          {snapshot.onboardingState === "manual_only" ? (
            <div className="mt-5 rounded-[1.5rem] border border-ocean/10 bg-white/60 p-5 text-sm leading-6 text-slate-600">
              오늘 일정은 비어 있지만 이번 주 미션은 있어요. 주간 미션은 오른쪽에 따로 두고, 여기에는 오늘 실행할 작은 작업만 표시합니다.
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {quests.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-ocean/20 bg-white/60 p-5 text-sm text-slate-500">
                아직 생성된 퀘스트가 없습니다. 캘린더를 동기화하거나 수동으로 퀘스트를 추가해보세요.
              </div>
            ) : null}

            {quests.map((quest) => (
              <article
                key={quest.id}
                className={cn(
                  "w-full rounded-[1.6rem] border p-5 text-left transition",
                  quest.completed
                    ? "border-transparent bg-gradient-to-r from-sage to-cream"
                    : "border-ocean/10 bg-white"
                )}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ocean/5 px-3 py-1 text-xs font-semibold text-ocean">
                        {categoryLabel[quest.category]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {sourceLabel[quest.source]}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatClock(quest.startTime)} - {formatClock(quest.endTime)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{quest.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{quest.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 md:w-32 md:flex-col md:items-stretch">
                    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-coral/10 px-3 py-2 text-xs font-black text-coral">
                      보상 {quest.xp} XP
                    </span>
                    {quest.source === "manual" && !quest.completed ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteManualQuest(quest)}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                      >
                        삭제
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleComplete(quest)}
                      disabled={quest.completed}
                      className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-black shadow-sm transition disabled:cursor-default",
                        quest.completed
                          ? "bg-green-600 text-white"
                          : "bg-ocean text-white hover:-translate-y-0.5 hover:bg-ocean/90 hover:shadow-md"
                      )}
                    >
                      {quest.completed ? "완료됨" : "완료하기"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-slate-500">이번 주 미션</p>
          <h2 className="section-title mt-1 text-2xl font-black text-ocean">
            {snapshot.weeklyMission?.title ?? "주간 미션을 준비 중이에요"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {snapshot.weeklyMission?.description ??
              "W1 미션이나 주간 미션 이벤트를 캘린더에 적어두면 여기에는 주간 방향으로만 표시합니다."}
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-slate-500">오늘 집중</p>
          <h2 className="mt-1 text-2xl font-black text-ocean">
            {openQuests.length > 0 ? `남은 퀘스트 ${openQuests.length}개` : "오늘치 완료"}
          </h2>
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>{completedCount}/{quests.length || 0} 완료</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-ocean/10">
              <div
                className="h-full rounded-full bg-coral"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {nextQuest ? (
            <div className="mt-5 rounded-2xl border border-ocean/10 bg-white p-4">
              <p className="text-xs font-semibold text-slate-400">다음 퀘스트</p>
              <h3 className="mt-2 font-bold text-slate-900">{nextQuest.title}</h3>
              <p className="mt-2 text-sm text-slate-500">
                {formatClock(nextQuest.startTime)} - {formatClock(nextQuest.endTime)} · {nextQuest.xp} XP
              </p>
            </div>
          ) : (
            <Link
              href="/history"
              className="mt-5 inline-flex rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90"
            >
              완료 기록 보기
            </Link>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-slate-500">오늘의 운영 메모</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>캘린더 이벤트가 있으면 그 일정이 오늘의 퀘스트 우선순위가 됩니다.</li>
            <li>오늘 일정이 없으면 주간 미션 설명에서 오늘치 작업을 추출합니다.</li>
            <li>둘 다 없으면 온보딩과 수동 퀘스트 입력 흐름으로 이어집니다.</li>
          </ul>
        </div>
      </aside>

      {notice ? (
        <div
          className={cn(
            "fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold shadow-lg",
            notice.type === "success" && "bg-ocean text-white",
            notice.type === "error" && "bg-red-50 text-red-700",
            notice.type === "info" && "bg-slate-900 text-white"
          )}
        >
          <span>{notice.text}</span>
          {undoState && notice.type === "success" ? (
            <button
              type="button"
              onClick={handleUndoComplete}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/25"
            >
              실행 취소
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
