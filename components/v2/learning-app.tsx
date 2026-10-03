"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { signIn, signOut } from "next-auth/react";
import type { Route } from "next";
import { Icon, type IconName } from "./icon";
import {
  type Workspace,
  type Task,
  type Goal,
  type Source,
} from "@/lib/v2/model";
import { applyCommand, commandSchema } from "@/lib/v2/commands";
import { statsFor, scheduleWorkspace } from "@/lib/v2/scheduler";
import {
  addDays,
  dateKey,
  weekKey,
  dayDistance,
  clockLabel,
} from "@/lib/v2/time";
import { demoWorkspace } from "@/lib/v2/demo";
import type { Decomposition } from "@/lib/v2/ai";
import type { WebSourceResult } from "@/lib/types";

const nav = [
  { id: "today", title: "오늘", href: "/dashboard", icon: "sun" },
  { id: "quests", title: "퀘스트", href: "/quests", icon: "quest" },
  { id: "goals", title: "목표", href: "/goals", icon: "goal" },
  { id: "missions", title: "주간 미션", href: "/missions", icon: "flag" },
  { id: "sources", title: "학습 자료", href: "/sources", icon: "book" },
  { id: "history", title: "진행 기록", href: "/history", icon: "history" },
  { id: "plan", title: "AI 계획", href: "/plan", icon: "spark" },
  { id: "settings", title: "설정", href: "/settings", icon: "settings" },
] as const;
export type View = (typeof nav)[number]["id"];
type Config = {
  storage: "file" | "supabase" | "demo";
  ai: boolean;
  calendar: boolean;
  notion: boolean;
};
type Modal =
  | { type: "quest"; task?: Task; source?: Source }
  | { type: "goal"; goal?: Goal }
  | { type: "complete"; task: Task }
  | { type: "postpone"; task: Task }
  | { type: "source"; source?: Source }
  | { type: "mission" };
const categoryLabel = {
  sql: "데이터 · SQL",
  coding: "코딩",
  study: "학습",
  review: "복습",
};
const demoKey = "ilque-v2-demo-1";
const viewCopy: Record<View, [string, string]> = {
  today: [
    "오늘의 한 걸음, 내일의 실력.",
    "오늘 무엇을 공부할지, 여기서 시작해요.",
  ],
  quests: ["한 번에 하나씩, 퀘스트.", "작은 실행을 쌓아 목표에 가까워지세요."],
  goals: [
    "가고 싶은 곳을 정해요.",
    "목표와 마감일이 오늘의 학습 방향이 됩니다.",
  ],
  missions: [
    "이번 주도, 나답게 꾸준히.",
    "무리하지 않는 작은 약속을 지켜보세요.",
  ],
  sources: [
    "배움의 재료를 모아요.",
    "책, 강의, 노트를 다음 퀘스트로 연결하세요.",
  ],
  history: ["이만큼 성장했어요.", "작은 완료 하나도 빠짐없이 남아 있어요."],
  plan: [
    "큰 목표를, 작은 실행으로.",
    "AI와 학습 작업을 정리하고 가능한 시간에 배치해요.",
  ],
  settings: [
    "나에게 맞는 학습 리듬.",
    "공부할 수 있는 시간과 연결 상태를 관리하세요.",
  ],
};
function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="v2-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Empty({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="v2-empty">
      <span className="v2-empty-icon">
        <Icon name="book" size={30} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  icon,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      className={`v2-button ${secondary ? "secondary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={17} />} {children}
    </button>
  );
}

export function LearningApp({
  view,
  viewer,
  demo = false,
}: {
  view: View;
  viewer: { name: string; email?: string };
  demo?: boolean;
}) {
  const [state, setState] = useState<Workspace | null>(null),
    [config, setConfig] = useState<Config>({
      storage: demo ? "demo" : "supabase",
      ai: false,
      calendar: false,
      notion: false,
    });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [mobile, setMobile] = useState(false);
  const [filter, setFilter] = useState("pending"),
    [search, setSearch] = useState(""),
    [selectedGoal, setSelectedGoal] = useState(""),
    [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<Decomposition | null>(null),
    [webResults, setWebResults] = useState<WebSourceResult[]>([]);
  const autoSync = useRef(false),
    pending = useRef(false);
  const load = useCallback(async () => {
    setError("");
    try {
      if (demo) {
        const saved = localStorage.getItem(demoKey);
        const next = saved ? (JSON.parse(saved) as Workspace) : demoWorkspace();
        setState(next);
        return;
      }
      const response = await fetch("/api/v2", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "데이터를 불러오지 못했어요.");
      setState(data.state);
      setConfig(data.config);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [demo]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const listener = () => {
      if (!pending.current) {
        autoSync.current = false;
        void load();
      }
    };
    window.addEventListener("focus", listener);
    return () => window.removeEventListener("focus", listener);
  }, [load]);
  async function run(command: unknown): Promise<boolean> {
    if (!state || pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let next: Workspace;
      if (demo) {
        const parsed = commandSchema.safeParse(command);
        if (!parsed.success)
          throw new Error(
            "체험 모드에서는 직접 퀘스트와 목표를 관리할 수 있어요. 실제 연동은 Google 로그인 후 이용해 주세요.",
          );
        const saved = localStorage.getItem(demoKey);
        if (
          saved &&
          (JSON.parse(saved) as Workspace).revision !== state.revision
        )
          throw new Error("다른 화면에서 변경됐어요. 새로 불러와 주세요.");
        next = applyCommand(state, parsed.data);
        next.revision++;
        localStorage.setItem(demoKey, JSON.stringify(next));
      } else {
        const response = await fetch("/api/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: state.revision, command }),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "변경을 저장하지 못했어요.");
        if (data.preview) {
          setPreview(data.preview);
          return true;
        }
        next = data.state;
        if (data.notice) setNotice(data.notice);
      }
      setState(next);
      setNotice(
        (previous) => previous || "저장했어요. 다음 퀘스트에도 반영됩니다.",
      );
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  useEffect(() => {
    if (!state || demo || autoSync.current) return;
    autoSync.current = true;
    const today = dateKey(new Date(), state.settings.timeZone);
    if (
      config.calendar &&
      (!state.calendarSyncedAt ||
        Date.now() - Date.parse(state.calendarSyncedAt) > 15 * 60000)
    )
      void run({ type: "calendar.sync" });
    else if (
      !state.report ||
      dateKey(state.report.at, state.settings.timeZone) !== today
    )
      void run({ type: "replan" });
    // Exactly one automatic refresh on opening; actions replan without an LLM call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, config.calendar]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const destination = (href: string, id: View) =>
    (demo ? `/demo?view=${id}` : href) as Route;
  const stats = state
    ? statsFor(state)
    : {
        xp: 0,
        level: 1,
        streak: 0,
        completed: 0,
        minutes: 0,
        dates: [] as string[],
      };
  const today = dateKey(new Date(), state?.settings.timeZone),
    week = weekKey(today);
  const todayTasks =
    state?.tasks
      .filter(
        (t) =>
          (t.status === "completed" && t.completedAt
            ? dateKey(t.completedAt, state.settings.timeZone) === today
            : t.scheduledStart &&
              dateKey(t.scheduledStart, state.settings.timeZone) === today) &&
          t.status !== "skipped",
      )
      .sort(
        (a, b) =>
          Number(a.status === "completed") - Number(b.status === "completed") ||
          (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""),
      ) ?? [];
  const doneToday = todayTasks.filter((t) => t.status === "completed").length,
    nextTask = todayTasks.find((t) => t.status === "pending");
  const mission = state?.missions.find((m) => m.week === week);
  const weekDone =
    state?.tasks.filter(
      (t) =>
        t.status === "completed" &&
        t.completedAt &&
        dateKey(t.completedAt, state.settings.timeZone) >= week &&
        dateKey(t.completedAt, state.settings.timeZone) < addDays(week, 7) &&
        (!mission?.goalId || t.goalId === mission.goalId),
    ).length ?? 0;
  const activeGoals = state?.goals.filter((g) => !g.archived) ?? [];
  const goalProgress = (goal: Goal) =>
    Math.min(
      100,
      Math.round(
        ((state?.tasks
          .filter((t) => t.goalId === goal.id && t.status === "completed")
          .reduce((s, t) => s + t.estimatedMinutes, 0) ?? 0) /
          goal.totalMinutes) *
          100,
      ),
    );
  function taskCard(task: Task, compact = false) {
    const goal = state?.goals.find((g) => g.id === task.goalId);
    return (
      <article
        key={task.id}
        className={`v2-quest-card ${task.status === "completed" ? "completed" : ""} ${compact ? "compact" : ""}`}
      >
        <button
          className="v2-complete"
          disabled={busy}
          aria-label={
            task.status === "completed"
              ? `${task.title} 완료 취소`
              : `${task.title} 완료`
          }
          onClick={() =>
            task.status === "completed"
              ? void run({ type: "quest.undo", id: task.id })
              : setModal({ type: "complete", task })
          }
        >
          {task.status === "completed" && <Icon name="check" size={18} />}
        </button>
        <div className="v2-quest-content">
          <div className="v2-tags">
            <span className={`v2-tag ${task.category}`}>
              {categoryLabel[task.category]}
            </span>
            {task.locked && <span className="v2-tag">시간 고정</span>}
            {task.postponements > 0 && (
              <span className="v2-tag">{task.postponements}회 미룸</span>
            )}
            <span className="v2-xp">+{task.xp} 경험치</span>
          </div>
          <h3>{task.title}</h3>
          <p>{goal?.title ?? "나의 학습 퀘스트"}</p>
          <div className="v2-task-meta">
            <span>
              <Icon name="clock" size={14} />
              {task.status === "completed"
                ? `${task.actualMinutes ?? task.estimatedMinutes}분 학습`
                : `${task.estimatedMinutes}분 예상`}
            </span>
            {task.scheduledStart && (
              <span>
                {dateKey(task.scheduledStart, state?.settings.timeZone) ===
                today
                  ? "오늘"
                  : dateKey(
                      task.scheduledStart,
                      state?.settings.timeZone,
                    ).slice(5)}{" "}
                {clockLabel(task.scheduledStart, state?.settings.timeZone)}
              </span>
            )}
          </div>
          {!compact && task.status === "pending" && (
            <p className="v2-reason">{task.reason}</p>
          )}
        </div>
        <div className="v2-task-actions">
          {task.status === "pending" && (
            <>
              <button
                disabled={busy}
                onClick={() => setModal({ type: "quest", task })}
              >
                수정
              </button>
              <button
                disabled={busy}
                onClick={() => setModal({ type: "postpone", task })}
              >
                미루기
              </button>
              {!compact && (
                <button
                  disabled={busy}
                  onClick={() => void run({ type: "quest.skip", id: task.id })}
                >
                  제외
                </button>
              )}
            </>
          )}
          {task.status === "completed" && (
            <span className="v2-done-label">완료했어요</span>
          )}
          {task.status === "skipped" && (
            <button
              onClick={() => void run({ type: "quest.restore", id: task.id })}
            >
              복구
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="v2-app">
      <a className="v2-skip" href="#main">
        본문으로 건너뛰기
      </a>
      {mobile && (
        <button
          className="v2-nav-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`v2-sidebar ${mobile ? "open" : ""}`}>
        <Link href={destination("/dashboard", "today")} className="v2-logo">
          <span className="v2-logo-mark">
            <Icon name="spark" size={26} />
          </span>
          <strong>
            ILQue<span>나의 매일을 퀘스트로</span>
          </strong>
        </Link>
        <p className="v2-nav-label">나의 학습 여정</p>
        <nav aria-label="주요 메뉴">
          {nav.map((item) => (
            <Link
              aria-current={view === item.id ? "page" : undefined}
              key={item.id}
              href={destination(item.href, item.id)}
              onClick={() => setMobile(false)}
              className={view === item.id ? "active" : ""}
            >
              <Icon name={item.icon} />
              {item.title}
              {item.id === "today" &&
                todayTasks.filter((t) => t.status === "pending").length > 0 && (
                  <span className="v2-nav-count">
                    {todayTasks.filter((t) => t.status === "pending").length}
                  </span>
                )}
            </Link>
          ))}
        </nav>
        <div className="v2-sidebar-bottom">
          <div className="v2-level-card">
            <div>
              <span className="v2-medal">✦</span>
              <strong>
                레벨 {stats.level}
                <small>차근차근 성장하는 학습자</small>
              </strong>
            </div>
            <Progress value={stats.xp % 100} label="다음 레벨 진행률" />
            <p>
              {stats.xp % 100} / 100 경험치{" "}
              <span>다음 레벨까지 {100 - (stats.xp % 100)}</span>
            </p>
          </div>
          <div className="v2-account">
            <span>{viewer.name.slice(0, 1)}</span>
            <strong>
              {viewer.name}
              <small>{demo ? "둘러보는 중" : "나의 학습 공간"}</small>
            </strong>
            <button
              aria-label={demo ? "로그인 화면" : "로그아웃"}
              onClick={() =>
                demo ? location.assign("/") : void signOut({ callbackUrl: "/" })
              }
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="v2-main-wrap">
        <header className="v2-topbar">
          <div>
            <button
              className="v2-menu-button"
              onClick={() => setMobile(true)}
              aria-label="메뉴 열기"
            >
              <Icon name="menu" />
            </button>
            <span>{nav.find((n) => n.id === view)?.title}</span>
            <span className="v2-top-separator">/</span>
            <span className="v2-top-date">
              {new Intl.DateTimeFormat("ko-KR", {
                month: "long",
                day: "numeric",
                weekday: "long",
                timeZone: state?.settings.timeZone ?? "Asia/Seoul",
              }).format(new Date())}
            </span>
          </div>
          <div className="v2-top-stats">
            <span className="v2-streak">
              <Icon name="fire" size={18} />
              {stats.streak}일 연속
            </span>
            <span className="v2-total-xp">✦ {stats.xp} 경험치</span>
          </div>
        </header>
        <main id="main" className="v2-main" aria-busy={busy}>
          {demo && (
            <div className="v2-mode-banner">
              체험 공간 · 예시 데이터이며 이 브라우저에만 저장됩니다.{" "}
              <Link href="/">
                Google로 내 학습 시작하기 <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
          {!demo && config.storage === "file" && (
            <div className="v2-mode-banner">
              이 기기에 저장 중 · 클라우드와 별도로 보관됩니다.{" "}
              <Link href={"/settings" as Route}>저장 설정 확인</Link>
            </div>
          )}
          <div className="v2-page-heading">
            <div>
              <p className="v2-eyebrow">
                {view === "today"
                  ? `${viewer.name} 님, 반가워요`
                  : "나의 학습 여정"}
              </p>
              <h1>{viewCopy[view][0]}</h1>
              <p>{viewCopy[view][1]}</p>
            </div>
            {(view === "today" || view === "quests") && (
              <Button
                icon="plus"
                onClick={() => setModal({ type: "quest" })}
                disabled={!state || busy}
              >
                퀘스트 추가
              </Button>
            )}
            {view === "goals" && (
              <Button
                icon="plus"
                onClick={() => setModal({ type: "goal" })}
                disabled={!state || busy}
              >
                새 목표 만들기
              </Button>
            )}
            {view === "sources" && (
              <Button
                icon="plus"
                onClick={() => setModal({ type: "source" })}
                disabled={!state || busy}
              >
                자료 추가
              </Button>
            )}
          </div>
          {error && (
            <div className="v2-alert" role="alert">
              <div>
                <strong>잠시 확인이 필요해요</strong>
                <p>{error}</p>
              </div>
              <button onClick={() => void load()}>다시 불러오기</button>
            </div>
          )}
          {notice && (
            <div className="v2-toast" role="status">
              <Icon name="check" size={17} />
              {notice}
            </div>
          )}
          {!state && !error && (
            <div className="v2-loading" role="status">
              <span />
              학습 공간을 불러오고 있어요…
            </div>
          )}
          {state && (
            <>
              {view === "today" && (
                <>
                  <section className="v2-today-hero">
                    <div className="v2-hero-copy">
                      <span className="v2-hero-kicker">
                        <span /> 오늘의 학습 여정
                      </span>
                      <h2>
                        {nextTask ? (
                          <>
                            오늘은{" "}
                            <em>
                              {
                                todayTasks.filter((t) => t.status === "pending")
                                  .length
                              }
                              개의 퀘스트
                            </em>
                            로<br />한 걸음 더 나아가요.
                          </>
                        ) : doneToday > 0 ? (
                          <>
                            오늘도 해냈어요.
                            <br />
                            <em>배움이 쌓이고 있어요.</em>
                          </>
                        ) : (
                          <>
                            작은 퀘스트 하나로
                            <br />
                            <em>오늘의 배움을 시작해요.</em>
                          </>
                        )}
                      </h2>
                      <p>
                        {nextTask
                          ? `가능한 시간과 목표에 맞춰 준비했어요. 첫 퀘스트는 ${nextTask.estimatedMinutes}분이면 충분해요.`
                          : "목표를 정하고 실행할 작업을 추가하면 오늘의 계획이 만들어져요."}
                      </p>
                      <Button
                        icon={nextTask ? "arrow" : "plus"}
                        onClick={() =>
                          nextTask
                            ? setModal({ type: "complete", task: nextTask })
                            : setModal({ type: "goal" })
                        }
                      >
                        {nextTask ? "첫 퀘스트 살펴보기" : "나의 목표 정하기"}
                      </Button>
                    </div>
                    <div className="v2-hero-art" aria-hidden="true">
                      <span className="v2-orbit orbit-one" />
                      <span className="v2-orbit orbit-two" />
                      <span className="v2-art-star star-one">✦</span>
                      <span className="v2-art-star star-two">✧</span>
                      <div className="v2-art-tile tile-back" />
                      <div className="v2-art-tile tile-front">
                        <Icon name="book" size={65} />
                        <span>오늘도 한 걸음</span>
                        <div className="v2-art-lines">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                      <span className="v2-art-badge">
                        <Icon name="check" size={27} />
                      </span>
                      <span className="v2-art-xp">✦ 배움 +1</span>
                    </div>
                  </section>
                  <div className="v2-metrics">
                    <article>
                      <span className="v2-metric-icon mint">
                        <Icon name="quest" />
                      </span>
                      <div>
                        <p>오늘의 완료</p>
                        <strong>
                          {doneToday}
                          <small> / {todayTasks.length} 퀘스트</small>
                        </strong>
                      </div>
                      <span className="v2-metric-note">한 개씩, 차근차근</span>
                    </article>
                    <article>
                      <span className="v2-metric-icon peach">
                        <Icon name="clock" />
                      </span>
                      <div>
                        <p>오늘 학습 시간</p>
                        <strong>
                          {todayTasks
                            .filter((t) => t.status === "completed")
                            .reduce(
                              (s, t) =>
                                s + (t.actualMinutes ?? t.estimatedMinutes),
                              0,
                            )}
                          <small>분</small>
                        </strong>
                      </div>
                      <span className="v2-metric-note">
                        계획 {state.report?.plannedMinutes ?? 0}분
                      </span>
                    </article>
                    <article>
                      <span className="v2-metric-icon lavender">
                        <Icon name="flag" />
                      </span>
                      <div>
                        <p>이번 주 미션</p>
                        <strong>
                          {weekDone}
                          <small> / {mission?.target ?? 5} 퀘스트</small>
                        </strong>
                      </div>
                      <span className="v2-metric-note">
                        꾸준함이 실력이 돼요
                      </span>
                    </article>
                  </div>
                  <div className="v2-dashboard-grid">
                    <div>
                      <section>
                        <div className="v2-section-heading">
                          <h2>
                            오늘의 퀘스트 <span>{todayTasks.length}</span>
                          </h2>
                          <button
                            className="v2-text-button"
                            disabled={busy}
                            onClick={() => void run({ type: "replan" })}
                          >
                            <Icon name="refresh" size={15} />
                            계획 재조정
                          </button>
                        </div>
                        <div className="v2-filter-tabs">
                          <button
                            className={filter !== "completed" ? "active" : ""}
                            onClick={() => setFilter("pending")}
                          >
                            해야 할 일 {todayTasks.length - doneToday}
                          </button>
                          <button
                            className={filter === "completed" ? "active" : ""}
                            onClick={() => setFilter("completed")}
                          >
                            완료 {doneToday}
                          </button>
                        </div>
                        <div className="v2-quest-list">
                          {todayTasks
                            .filter((t) =>
                              filter === "completed"
                                ? t.status === "completed"
                                : t.status === "pending",
                            )
                            .map((t) => taskCard(t, true))}
                          {!todayTasks.some((t) =>
                            filter === "completed"
                              ? t.status === "completed"
                              : t.status === "pending",
                          ) && (
                            <Empty
                              title={
                                filter === "completed"
                                  ? "아직 완료한 퀘스트가 없어요"
                                  : "오늘의 여백을 채워볼까요?"
                              }
                              body={
                                filter === "completed"
                                  ? "퀘스트를 마치면 경험치와 학습 기록이 쌓여요."
                                  : "목표에서 AI 계획을 만들거나 퀘스트를 직접 추가해 보세요."
                              }
                            >
                              <Link
                                className="v2-inline-link"
                                href={destination("/plan", "plan")}
                              >
                                학습 계획 만들기 <Icon name="arrow" size={16} />
                              </Link>
                            </Empty>
                          )}
                        </div>
                        <button
                          className="v2-add-quest"
                          onClick={() => setModal({ type: "quest" })}
                        >
                          <Icon name="plus" size={18} />
                          작은 퀘스트 하나 더하기
                        </button>
                      </section>
                      {state.report && state.report.warnings.length > 0 && (
                        <section className="v2-plan-notice">
                          <Icon name="spark" />
                          <div>
                            <h3>계획에 여유가 필요해요</h3>
                            {state.report.warnings.slice(0, 3).map((w, i) => (
                              <p key={i}>{w}</p>
                            ))}
                            <Link href={destination("/quests", "quests")}>
                              미배정 퀘스트 확인 →
                            </Link>
                          </div>
                        </section>
                      )}
                      <section className="v2-goal-summary">
                        <div className="v2-section-heading">
                          <h2>지금 향하고 있는 목표</h2>
                          <Link href={destination("/goals", "goals")}>
                            전체 보기 <Icon name="chevron" size={13} />
                          </Link>
                        </div>
                        {activeGoals.slice(0, 2).map((goal) => (
                          <article key={goal.id}>
                            <span className={`v2-goal-symbol ${goal.category}`}>
                              <Icon name="goal" size={25} />
                            </span>
                            <div>
                              <div>
                                <strong>{goal.title}</strong>
                                <small>
                                  {goal.deadline < today
                                    ? "마감 지남"
                                    : `D-${dayDistance(today, goal.deadline)}`}
                                </small>
                              </div>
                              <Progress
                                value={goalProgress(goal)}
                                label={goal.title}
                              />
                              <p>
                                목표까지 차근차근 <b>{goalProgress(goal)}%</b>
                              </p>
                            </div>
                          </article>
                        ))}
                        {!activeGoals.length && (
                          <div className="v2-soft-empty">
                            아직 목표가 없어요. 이루고 싶은 배움을 정해 보세요.
                          </div>
                        )}
                      </section>
                    </div>
                    <aside className="v2-right-column">
                      <section className="v2-panel v2-week-card">
                        <div className="v2-section-heading">
                          <h2>꾸준함의 기록</h2>
                          <span className="v2-streak">
                            <Icon name="fire" size={16} />
                            {stats.streak}일
                          </span>
                        </div>
                        <div className="v2-week-dots">
                          {Array.from({ length: 7 }, (_, i) => {
                            const key = addDays(week, i);
                            return (
                              <div
                                key={key}
                                className={key === today ? "today" : ""}
                              >
                                <span>
                                  {
                                    ["월", "화", "수", "목", "금", "토", "일"][
                                      i
                                    ]
                                  }
                                </span>
                                <b
                                  className={
                                    stats.dates.includes(key) ? "done" : ""
                                  }
                                >
                                  {stats.dates.includes(key) ? (
                                    <Icon name="check" size={14} />
                                  ) : (
                                    i + 1
                                  )}
                                </b>
                              </div>
                            );
                          })}
                        </div>
                        <p>하루의 작은 완료가 좋은 습관이 돼요.</p>
                      </section>
                      <section className="v2-panel v2-mission-card">
                        <span className="v2-small-label">
                          <Icon name="flag" size={15} />
                          이번 주의 작은 약속
                        </span>
                        <h3>{mission?.title ?? "나만의 주간 미션을 정해요"}</h3>
                        <p>퀘스트 {mission?.target ?? 5}개 완료하기</p>
                        <Progress
                          value={(weekDone / (mission?.target ?? 5)) * 100}
                          label="주간 미션 진행률"
                        />
                        <div>
                          <strong>
                            {weekDone} / {mission?.target ?? 5}
                          </strong>
                          <button onClick={() => setModal({ type: "mission" })}>
                            미션 수정 →
                          </button>
                        </div>
                      </section>
                      <section className="v2-panel">
                        <div className="v2-section-heading">
                          <h2>오늘의 타임라인</h2>
                          <button
                            aria-label="캘린더 동기화"
                            disabled={busy}
                            onClick={() => void run({ type: "calendar.sync" })}
                          >
                            <Icon name="refresh" size={16} />
                          </button>
                        </div>
                        <p className="v2-caption">
                          고정 일정 사이에 학습 시간을 만들어요.
                        </p>
                        <div className="v2-timeline">
                          {[
                            ...state.calendar
                              .filter((e) =>
                                e.isAllDay
                                  ? e.start <= today && e.end > today
                                  : dateKey(
                                      e.start,
                                      state.settings.timeZone,
                                    ) === today,
                              )
                              .map((e) => ({
                                id: e.id,
                                title: e.summary,
                                start: e.start,
                                allDay: e.isAllDay,
                                quest: false,
                              })),
                            ...todayTasks
                              .filter((t) => t.scheduledStart)
                              .map((t) => ({
                                id: t.id,
                                title: t.title,
                                start: t.scheduledStart!,
                                allDay: false,
                                quest: true,
                              })),
                          ]
                            .sort((a, b) => a.start.localeCompare(b.start))
                            .map((e) => (
                              <div
                                key={e.id}
                                className={e.quest ? "quest" : ""}
                              >
                                <span>
                                  {e.allDay
                                    ? "종일"
                                    : clockLabel(
                                        e.start,
                                        state.settings.timeZone,
                                      )}
                                </span>
                                <i />
                                <p>
                                  {e.title}
                                  <small>
                                    {e.quest
                                      ? "학습 퀘스트"
                                      : "캘린더 · 고정 일정"}
                                  </small>
                                </p>
                              </div>
                            ))}
                        </div>
                        {!state.calendar.length && !todayTasks.length && (
                          <p className="v2-soft-empty">
                            아직 등록된 일정이 없어요.
                          </p>
                        )}
                        <p className="v2-sync-status">
                          {demo
                            ? "체험용 예시 일정"
                            : state.calendarSyncedAt
                              ? `${clockLabel(state.calendarSyncedAt, state.settings.timeZone)} 마지막 동기화`
                              : "캘린더 동기화 전"}
                        </p>
                      </section>
                    </aside>
                  </div>
                </>
              )}
              {view === "quests" && (
                <>
                  <div className="v2-toolbar">
                    <div className="v2-filter-tabs">
                      {[
                        ["pending", "예정"],
                        ["deferred", "시간 미배정"],
                        ["completed", "완료"],
                        ["skipped", "제외"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          className={filter === key ? "active" : ""}
                          onClick={() => setFilter(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Button
                      secondary
                      icon="refresh"
                      disabled={busy}
                      onClick={() => void run({ type: "replan" })}
                    >
                      계획 재조정
                    </Button>
                  </div>
                  <div className="v2-search">
                    <input
                      aria-label="퀘스트 검색"
                      placeholder="퀘스트 이름으로 찾아보기"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="v2-quest-list">
                    {state.tasks
                      .filter(
                        (t) =>
                          (filter === "deferred"
                            ? t.status === "pending" && !t.scheduledStart
                            : t.status === filter) && t.title.includes(search),
                      )
                      .sort((a, b) =>
                        (a.scheduledStart ?? "z").localeCompare(
                          b.scheduledStart ?? "z",
                        ),
                      )
                      .map((t) => taskCard(t))}
                    {!state.tasks.some(
                      (t) =>
                        (filter === "deferred"
                          ? t.status === "pending" && !t.scheduledStart
                          : t.status === filter) && t.title.includes(search),
                    ) && (
                      <Empty
                        title="여기는 아직 비어 있어요"
                        body="새 퀘스트를 추가하거나 다른 상태를 선택해 보세요."
                      />
                    )}
                  </div>
                </>
              )}
              {view === "goals" && (
                <div className="v2-card-grid">
                  {state.goals.map((goal) => (
                    <article className="v2-panel v2-goal-card" key={goal.id}>
                      <div className="v2-card-top">
                        <span className={`v2-goal-symbol ${goal.category}`}>
                          <Icon name="goal" size={27} />
                        </span>
                        <span className="v2-tag">
                          {goal.archived
                            ? "보관한 목표"
                            : goal.deadline < today
                              ? "마감 지남"
                              : `D-${dayDistance(today, goal.deadline)}`}
                        </span>
                      </div>
                      <h2>{goal.title}</h2>
                      <p>
                        {goal.description ||
                          "작은 실행을 통해 목표에 도달해요."}
                      </p>
                      <Progress value={goalProgress(goal)} label={goal.title} />
                      <div className="v2-goal-details">
                        <span>{goalProgress(goal)}% 진행</span>
                        <span>
                          {Math.round((goal.totalMinutes / 60) * 10) / 10}시간
                          목표
                        </span>
                      </div>
                      <dl>
                        <div>
                          <dt>마감일</dt>
                          <dd>{goal.deadline}</dd>
                        </div>
                        <div>
                          <dt>학습 수준</dt>
                          <dd>{goal.level}</dd>
                        </div>
                      </dl>
                      <div className="v2-card-actions">
                        <Button
                          secondary
                          onClick={() => setModal({ type: "goal", goal })}
                        >
                          목표 수정
                        </Button>
                        <Link
                          className="v2-inline-link"
                          href={destination("/plan", "plan")}
                        >
                          계획 세우기 <Icon name="arrow" size={15} />
                        </Link>
                      </div>
                    </article>
                  ))}
                  {!state.goals.length && (
                    <Empty
                      title="어떤 배움을 이루고 싶나요?"
                      body="목표와 마감일, 예상 학습량을 입력하면 오늘의 계획에 반영돼요."
                    >
                      <Button
                        icon="plus"
                        onClick={() => setModal({ type: "goal" })}
                      >
                        첫 목표 만들기
                      </Button>
                    </Empty>
                  )}
                </div>
              )}
              {view === "missions" && (
                <>
                  <section className="v2-panel v2-mission-large">
                    <span className="v2-goal-symbol study">
                      <Icon name="flag" size={30} />
                    </span>
                    <p className="v2-eyebrow">
                      {week.slice(5)} – {addDays(week, 6).slice(5)}
                    </p>
                    <h2>{mission?.title ?? "이번 주의 작은 약속을 정해요"}</h2>
                    <p>학습 퀘스트 {mission?.target ?? 5}개 완료하기</p>
                    <div className="v2-mission-counter">
                      {weekDone}
                      <span> / {mission?.target ?? 5}</span>
                    </div>
                    <Progress
                      value={(weekDone / (mission?.target ?? 5)) * 100}
                      label="미션 달성률"
                    />
                    <p>
                      {weekDone >= (mission?.target ?? 5)
                        ? "이번 주 약속을 지켰어요. 수고했어요!"
                        : "한 번에 다 하지 않아도 괜찮아요. 오늘의 하나를 완료해 보세요."}
                    </p>
                    <Button
                      secondary
                      onClick={() => setModal({ type: "mission" })}
                    >
                      주간 미션 수정
                    </Button>
                  </section>
                  <section className="v2-panel v2-spaced">
                    <h2>이번 주에 해낸 일</h2>
                    {state.tasks
                      .filter(
                        (t) =>
                          t.status === "completed" &&
                          t.completedAt &&
                          dateKey(t.completedAt, state.settings.timeZone) >=
                            week,
                      )
                      .map((t) => taskCard(t, true))}
                    {!weekDone && (
                      <p className="v2-soft-empty">
                        첫 완료가 이곳에 기록될 거예요.
                      </p>
                    )}
                  </section>
                </>
              )}
              {view === "sources" && (
                <>
                  <section className="v2-panel v2-source-toolbar">
                    <div>
                      <h2>흩어진 자료를 한곳에</h2>
                      <p>
                        연결한 목표의 AI 계획에 자료의 제목과 요약이 반영돼요.
                      </p>
                    </div>
                    <Button
                      secondary
                      disabled={busy}
                      icon="refresh"
                      onClick={() => void run({ type: "notion.import" })}
                    >
                      Notion 자료 불러오기
                    </Button>
                  </section>
                  <form
                    className="v2-web-search"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (demo) {
                        setError(
                          "웹 검색은 Google 로그인 후 이용할 수 있어요.",
                        );
                        return;
                      }
                      setBusy(true);
                      setError("");
                      try {
                        const response = await fetch("/api/sources/search", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ query: search }),
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error);
                        setWebResults(result.results);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      aria-label="웹 자료 검색어"
                      placeholder="배우고 싶은 주제의 자료를 찾아보세요"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button type="submit" icon="spark" disabled={busy}>
                      웹에서 자료 찾기
                    </Button>
                  </form>
                  {webResults.length > 0 && (
                    <section className="v2-panel v2-spaced">
                      <h2>검색 결과</h2>
                      {webResults.map((s) => (
                        <article className="v2-search-result" key={s.id}>
                          <div>
                            <a href={s.url} target="_blank" rel="noreferrer">
                              {s.title} ↗
                            </a>
                            <p>{s.summary}</p>
                          </div>
                          <Button
                            secondary
                            onClick={() =>
                              setModal({
                                type: "source",
                                source: {
                                  id: "",
                                  title: s.title,
                                  summary: s.summary,
                                  url: s.url,
                                  origin: "web",
                                },
                              })
                            }
                          >
                            자료로 저장
                          </Button>
                        </article>
                      ))}
                    </section>
                  )}
                  <div className="v2-card-grid">
                    {state.sources.map((source) => (
                      <article
                        key={source.id}
                        className="v2-panel v2-source-card"
                      >
                        <div className="v2-card-top">
                          <span className="v2-goal-symbol review">
                            <Icon name="book" size={25} />
                          </span>
                          <span className="v2-tag">
                            {source.origin === "notion"
                              ? "Notion"
                              : source.origin === "web"
                                ? "웹 자료"
                                : "나의 자료"}
                          </span>
                        </div>
                        <h2>{source.title}</h2>
                        <p>{source.summary}</p>
                        {source.goalId && (
                          <span className="v2-tag">
                            {
                              state.goals.find((g) => g.id === source.goalId)
                                ?.title
                            }
                          </span>
                        )}
                        {source.url && /^https?:\/\//i.test(source.url) && (
                          <a
                            className="v2-source-url"
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            자료 열기 ↗
                          </a>
                        )}
                        <div className="v2-card-actions">
                          <Button
                            secondary
                            onClick={() => setModal({ type: "source", source })}
                          >
                            수정
                          </Button>
                          <Button
                            icon="plus"
                            onClick={() => setModal({ type: "quest", source })}
                          >
                            퀘스트 만들기
                          </Button>
                        </div>
                        {config.notion && (
                          <button
                            className="v2-text-button"
                            disabled={busy}
                            onClick={() =>
                              void run({
                                type: "notion.export",
                                sourceId: source.id,
                              })
                            }
                          >
                            Notion에도 저장
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                  {!state.sources.length && (
                    <Empty
                      title="배움의 재료를 담아보세요"
                      body="강의 링크나 학습 노트를 추가하고 목표와 연결할 수 있어요."
                    />
                  )}
                </>
              )}
              {view === "history" && (
                <>
                  <div className="v2-metrics history">
                    <article>
                      <Icon name="quest" />
                      <div>
                        <p>완료한 퀘스트</p>
                        <strong>
                          {stats.completed}
                          <small>개</small>
                        </strong>
                      </div>
                    </article>
                    <article>
                      <Icon name="clock" />
                      <div>
                        <p>쌓아온 학습 시간</p>
                        <strong>
                          {stats.minutes}
                          <small>분</small>
                        </strong>
                      </div>
                    </article>
                    <article>
                      <Icon name="spark" />
                      <div>
                        <p>누적 경험치</p>
                        <strong>{stats.xp}</strong>
                      </div>
                    </article>
                  </div>
                  <section className="v2-panel">
                    <div className="v2-section-heading">
                      <h2>최근 14일의 학습</h2>
                      <span className="v2-caption">완료한 퀘스트 수</span>
                    </div>
                    <div className="v2-chart">
                      {Array.from({ length: 14 }, (_, i) => {
                        const day = addDays(today, i - 13),
                          count = state.tasks.filter(
                            (t) =>
                              t.status === "completed" &&
                              t.completedAt &&
                              dateKey(
                                t.completedAt,
                                state.settings.timeZone,
                              ) === day,
                          ).length;
                        return (
                          <div key={day}>
                            <span>{count || ""}</span>
                            <i
                              style={{
                                height: `${Math.min(100, count * 20) + 4}px`,
                              }}
                            />
                            <small>{day.slice(8)}</small>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="v2-panel v2-spaced">
                    <h2>나의 학습 발자국</h2>
                    <div className="v2-history">
                      {state.activities.map((a) => (
                        <article key={a.id}>
                          <span
                            className={`v2-history-icon ${a.action.includes("complete") ? "done" : ""}`}
                          >
                            <Icon
                              name={
                                a.action.includes("complete")
                                  ? "check"
                                  : "history"
                              }
                              size={17}
                            />
                          </span>
                          <div>
                            <h3>{a.title}</h3>
                            <p>
                              {dateKey(a.at, state.settings.timeZone)} ·{" "}
                              {clockLabel(a.at, state.settings.timeZone)}
                              {a.minutes ? ` · ${a.minutes}분 학습` : ""}
                            </p>
                          </div>
                          {a.xp !== undefined && (
                            <strong>
                              {a.xp > 0 ? "+" : ""}
                              {a.xp} 경험치
                            </strong>
                          )}
                        </article>
                      ))}
                      {!state.activities.length && (
                        <Empty
                          title="이제 첫 발자국을 남겨볼까요?"
                          body="퀘스트와 계획의 변화가 이곳에 기록됩니다."
                        />
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === "plan" && (
                <div className="v2-plan-grid">
                  <section className="v2-panel">
                    <span className="v2-small-label">
                      <Icon name="spark" size={17} />
                      학습 계획 도우미
                    </span>
                    <h2>어떤 목표를 함께 나눠볼까요?</h2>
                    <p className="v2-caption">
                      작업을 검토한 뒤 적용하면, 가능한 시간에 자동으로
                      배치돼요.
                    </p>
                    <form
                      className="v2-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run({
                          type: "ai.preview",
                          goalId: selectedGoal,
                          instruction,
                        });
                      }}
                    >
                      <label>
                        학습 목표
                        <select
                          required
                          value={selectedGoal}
                          onChange={(e) => {
                            setSelectedGoal(e.target.value);
                            setPreview(null);
                          }}
                        >
                          <option value="">목표를 선택해 주세요</option>
                          {activeGoals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        이번 계획에 바라는 점
                        <textarea
                          value={instruction}
                          maxLength={2000}
                          onChange={(e) => setInstruction(e.target.value)}
                          placeholder="예: JOIN 기초는 알아요. 실전 문제와 오답 복습 위주로 나눠 주세요."
                          rows={4}
                        />
                      </label>
                      <Button
                        type="submit"
                        icon="spark"
                        disabled={busy || !selectedGoal}
                      >
                        {busy
                          ? "학습 작업을 정리하고 있어요…"
                          : "AI로 학습 작업 나누기"}
                      </Button>
                    </form>
                    {!activeGoals.length && (
                      <Link
                        className="v2-inline-link v2-spaced"
                        href={destination("/goals", "goals")}
                      >
                        먼저 목표 만들기 →
                      </Link>
                    )}
                    <div className="v2-ai-note">
                      <Icon name="book" size={17} />
                      <p>
                        선택한 목표에 연결된 자료의 제목과 요약을 참고해요. 적용
                        전에 내용을 직접 수정할 수 있어요.
                      </p>
                    </div>
                  </section>
                  <section className="v2-panel">
                    <h2>나에게 맞춘 계획 기준</h2>
                    <dl className="v2-plan-facts">
                      <div>
                        <dt>하루 학습 시간</dt>
                        <dd>{state.settings.dailyMinutes}분</dd>
                      </div>
                      <div>
                        <dt>공부 가능한 시간대</dt>
                        <dd>
                          {state.settings.dayStart} – {state.settings.dayEnd}
                        </dd>
                      </div>
                      <div>
                        <dt>최근 완료율</dt>
                        <dd>
                          {Math.round(
                            (state.report?.completionRate ?? 1) * 100,
                          )}
                          %
                        </dd>
                      </div>
                      <div>
                        <dt>실제 소요 시간 반영</dt>
                        <dd>
                          {(state.report?.durationFactor ?? 1).toFixed(2)}배
                        </dd>
                      </div>
                      <div>
                        <dt>시간 미배정</dt>
                        <dd>
                          {
                            state.tasks.filter(
                              (t) =>
                                t.status === "pending" && !t.scheduledStart,
                            ).length
                          }
                          개
                        </dd>
                      </div>
                    </dl>
                    <Button
                      secondary
                      icon="refresh"
                      disabled={busy}
                      onClick={() => void run({ type: "replan" })}
                    >
                      현재 퀘스트 재배치
                    </Button>
                    <p className="v2-caption v2-spaced">
                      직접 지정한 시간은 유지하고, 완료·미루기·소요 시간 변경은
                      다음 배치에 반영해요.
                    </p>
                  </section>
                  {preview && (
                    <section className="v2-panel v2-preview">
                      <div className="v2-section-heading">
                        <h2>적용 전, 한 번 살펴보세요</h2>
                        <span className="v2-tag">
                          {preview.tasks.length}개의 학습 작업
                        </span>
                      </div>
                      <p>{preview.summary}</p>
                      <div className="v2-preview-tasks">
                        {preview.tasks.map((task, index) => (
                          <div key={index}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <label>
                              퀘스트 이름
                              <input
                                required
                                value={task.title}
                                onChange={(e) =>
                                  setPreview({
                                    ...preview,
                                    tasks: preview.tasks.map((t, i) =>
                                      i === index
                                        ? { ...t, title: e.target.value }
                                        : t,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              예상 시간(분)
                              <input
                                type="number"
                                min={10}
                                max={90}
                                value={task.estimatedMinutes}
                                onChange={(e) =>
                                  setPreview({
                                    ...preview,
                                    tasks: preview.tasks.map((t, i) =>
                                      i === index
                                        ? {
                                            ...t,
                                            estimatedMinutes: Number(
                                              e.target.value,
                                            ),
                                          }
                                        : t,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <button
                              aria-label={`${task.title} 계획에서 빼기`}
                              onClick={() =>
                                setPreview({
                                  ...preview,
                                  tasks: preview.tasks.filter(
                                    (_, i) => i !== index,
                                  ),
                                })
                              }
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button
                        icon="check"
                        disabled={busy || !preview.tasks.length}
                        onClick={async () => {
                          if (
                            await run({
                              type: "ai.apply",
                              goalId: selectedGoal,
                              plan: preview,
                            })
                          )
                            setPreview(null);
                        }}
                      >
                        퀘스트로 저장하고 일정에 배치
                      </Button>
                    </section>
                  )}
                </div>
              )}
              {view === "settings" && (
                <div className="v2-plan-grid">
                  <section className="v2-panel">
                    <h2>나의 학습 시간</h2>
                    <SettingsForm
                      state={state}
                      busy={busy}
                      onSave={(data) => run({ type: "settings.save", data })}
                    />
                  </section>
                  <section className="v2-panel">
                    <h2>연결된 학습 도구</h2>
                    <div className="v2-connections">
                      <div>
                        <span className="v2-connection-logo">G</span>
                        <div>
                          <h3>Google Calendar</h3>
                          <p>
                            {config.calendar
                              ? "읽기 전용으로 연결됨"
                              : demo
                                ? "체험용 예시 일정"
                                : "다시 로그인하여 연결할 수 있어요"}
                          </p>
                        </div>
                        <Button
                          secondary
                          disabled={busy}
                          onClick={() =>
                            config.calendar
                              ? void run({ type: "calendar.sync" })
                              : void signIn("google", {
                                  callbackUrl: "/settings",
                                })
                          }
                        >
                          {config.calendar ? "동기화" : "연결"}
                        </Button>
                      </div>
                      <div>
                        <span className="v2-connection-logo">N</span>
                        <div>
                          <h3>Notion 자료실</h3>
                          <p>
                            {config.notion
                              ? "개인 자료실 연결됨"
                              : "서버에서 개인 계정 연결 필요"}
                          </p>
                        </div>
                        <span
                          className={`v2-tag ${config.notion ? "study" : ""}`}
                        >
                          {config.notion ? "연결됨" : "설정 필요"}
                        </span>
                      </div>
                      <div>
                        <span className="v2-connection-logo">
                          <Icon name="spark" />
                        </span>
                        <div>
                          <h3>Gemini 계획</h3>
                          <p>
                            {config.ai
                              ? "학습 작업 분해와 웹 검색"
                              : "서버에서 AI 연결 필요"}
                          </p>
                        </div>
                        <span className={`v2-tag ${config.ai ? "study" : ""}`}>
                          {config.ai ? "연결됨" : "설정 필요"}
                        </span>
                      </div>
                    </div>
                    <div className="v2-storage-card">
                      <h3>
                        {config.storage === "file"
                          ? "이 기기의 파일에 저장 중"
                          : config.storage === "demo"
                            ? "브라우저 체험 데이터"
                            : "Supabase에 저장 중"}
                      </h3>
                      <p>
                        {config.storage === "file"
                          ? "로그인한 계정별로 서버 기기에 저장합니다. 이 기기의 데이터 폴더를 보관해 주세요. 클라우드 데이터와 자동으로 합쳐지지 않습니다."
                          : config.storage === "demo"
                            ? "체험 데이터는 현재 브라우저에만 남습니다. 내 데이터는 로그인 후 관리하세요."
                            : "로그인한 계정의 학습 데이터를 클라우드에 저장합니다."}
                      </p>
                      <button
                        className="v2-text-button"
                        onClick={() => {
                          const blob = new Blob(
                              [JSON.stringify(state, null, 2)],
                              { type: "application/json" },
                            ),
                            url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `ilque-${today}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        내 학습 데이터 내려받기 ↓
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <footer className="v2-footer">
            <span>작은 퀘스트가 만드는, 나만의 성장.</span>
            <span>ILQue · 나의 학습 여정</span>
          </footer>
        </main>
      </div>
      {state && modal && (
        <Editor
          modal={modal}
          state={state}
          busy={busy}
          error={error}
          onClose={() => setModal(null)}
          onSubmit={async (command) => {
            const ok = await run(command);
            if (ok) setModal(null);
          }}
        />
      )}
    </div>
  );
}

function SettingsForm({
  state,
  busy,
  onSave,
}: {
  state: Workspace;
  busy: boolean;
  onSave: (data: Workspace["settings"]) => Promise<boolean>;
}) {
  return (
    <form
      className="v2-form"
      key={JSON.stringify(state.settings)}
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void onSave({
          dayStart: String(f.get("start")),
          dayEnd: String(f.get("end")),
          dailyMinutes: Number(f.get("minutes")),
          breakMinutes: Number(f.get("break")),
          timeZone: String(f.get("zone")),
        });
      }}
    >
      <label>
        하루 학습 가능 시간(분)
        <input
          name="minutes"
          type="number"
          min={15}
          max={720}
          required
          defaultValue={state.settings.dailyMinutes}
        />
        <small>고정 일정을 제외하고 이 시간 안에서 배치해요.</small>
      </label>
      <div className="v2-form-row">
        <label>
          시작 시간
          <input
            name="start"
            type="time"
            required
            defaultValue={state.settings.dayStart}
          />
        </label>
        <label>
          종료 시간
          <input
            name="end"
            type="time"
            required
            defaultValue={state.settings.dayEnd}
          />
        </label>
      </div>
      <label>
        퀘스트 사이 쉬는 시간(분)
        <input
          name="break"
          type="number"
          min={0}
          max={60}
          required
          defaultValue={state.settings.breakMinutes}
        />
      </label>
      <label>
        시간대
        <select name="zone" defaultValue={state.settings.timeZone}>
          <option value="Asia/Seoul">한국 · 서울</option>
          <option value="Asia/Tokyo">일본 · 도쿄</option>
          <option value="America/New_York">미국 · 뉴욕</option>
          <option value="America/Los_Angeles">미국 · 로스앤젤레스</option>
          <option value="Europe/London">영국 · 런던</option>
          <option value="UTC">세계 표준시</option>
        </select>
      </label>
      <Button type="submit" disabled={busy} icon="check">
        저장하고 계획에 반영
      </Button>
    </form>
  );
}
function Editor({
  modal,
  state,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  modal: Modal;
  state: Workspace;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (command: unknown) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    today = dateKey(new Date(), state.settings.timeZone);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node
      ?.querySelector<HTMLInputElement>("input[autofocus], textarea[autofocus]")
      ?.focus();
    return () => node?.close();
  }, []);
  const task = "task" in modal ? modal.task : undefined,
    goal = modal.type === "goal" ? modal.goal : undefined,
    source =
      modal.type === "source" || modal.type === "quest"
        ? modal.source
        : undefined;
  const [locked, setLocked] = useState(task?.locked ?? false);
  const title =
    modal.type === "complete"
      ? "오늘도 한 걸음 해냈나요?"
      : modal.type === "postpone"
        ? "다음에 이어서 해도 괜찮아요"
        : modal.type === "goal"
          ? goal
            ? "목표 다듬기"
            : "새로운 목표 정하기"
          : modal.type === "source"
            ? source?.id
              ? "학습 자료 수정"
              : "학습 자료 추가"
            : modal.type === "mission"
              ? "이번 주의 작은 약속"
              : task
                ? "퀘스트 다듬기"
                : "작은 퀘스트 만들기";
  const goalSelect = (value?: string) => (
    <label>
      연결할 목표
      <select name="goalId" defaultValue={value ?? ""}>
        <option value="">독립 퀘스트 / 자료</option>
        {state.goals
          .filter((g) => !g.archived)
          .map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
      </select>
    </label>
  );
  const categorySelect = (value = "study") => (
    <label>
      학습 분야
      <select name="category" defaultValue={value}>
        {Object.entries(categoryLabel).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      str = (k: string) => String(f.get(k) ?? ""),
      num = (k: string) => Number(f.get(k));
    if (modal.type === "complete")
      void onSubmit({
        type: "quest.complete",
        id: modal.task.id,
        actualMinutes: num("actual"),
      });
    else if (modal.type === "postpone")
      void onSubmit({
        type: "quest.postpone",
        id: modal.task.id,
        date: str("date"),
      });
    else if (modal.type === "mission")
      void onSubmit({
        type: "mission.save",
        title: str("title"),
        target: num("target"),
        goalId: str("goalId") || undefined,
      });
    else if (modal.type === "goal")
      void onSubmit({
        type: "goal.save",
        data: {
          id: goal?.id,
          title: str("title"),
          description: str("description"),
          category: str("category"),
          deadline: str("deadline"),
          totalMinutes: num("minutes"),
          level: str("level"),
          archived: f.get("archived") === "on",
        },
      });
    else if (modal.type === "source")
      void onSubmit({
        type: "source.save",
        data: {
          id: source?.id || undefined,
          title: str("title"),
          summary: str("summary"),
          url: str("url") || undefined,
          goalId: str("goalId") || undefined,
        },
      });
    else
      void onSubmit({
        type: "quest.save",
        data: {
          id: task?.id,
          title: str("title"),
          description: str("description"),
          category: str("category"),
          estimatedMinutes: num("minutes"),
          goalId: str("goalId") || undefined,
          sourceId: source?.id || task?.sourceId,
          date: str("date") || undefined,
          time: str("time") || undefined,
          locked,
          deadline: str("deadline") || undefined,
        },
      });
  }
  return (
    <dialog
      className="v2-dialog"
      ref={dialog}
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
      aria-labelledby="editor-title"
    >
      <div className="v2-dialog-heading">
        <span className="v2-goal-symbol study">
          <Icon
            name={
              modal.type === "complete"
                ? "check"
                : modal.type === "goal"
                  ? "goal"
                  : "quest"
            }
            size={24}
          />
        </span>
        <button aria-label="닫기" disabled={busy} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <h2 id="editor-title">{title}</h2>
      <form className="v2-form" onSubmit={submit}>
        {modal.type === "complete" || modal.type === "postpone" ? (
          <>
            <p className="v2-dialog-task">{modal.task.title}</p>
            {modal.type === "complete" ? (
              <>
                <p className="v2-caption">
                  {modal.task.description} · 실제 시간을 다음 계획에 반영할게요.
                </p>
                <label>
                  실제로 공부한 시간(분)
                  <input
                    autoFocus
                    name="actual"
                    type="number"
                    required
                    min={1}
                    max={1440}
                    defaultValue={modal.task.estimatedMinutes}
                  />
                </label>
                <div className="v2-reward">
                  ✦ 완료하면 {modal.task.xp} 경험치가 쌓여요
                </div>
              </>
            ) : (
              <label>
                언제부터 다시 할까요?
                <input
                  autoFocus
                  name="date"
                  type="date"
                  required
                  min={addDays(today, 1)}
                  defaultValue={addDays(today, 1)}
                />
                <small>해당 날짜 이후의 가능한 시간에 다시 배치해요.</small>
              </label>
            )}
          </>
        ) : (
          <>
            <label>
              {modal.type === "goal"
                ? "이루고 싶은 목표"
                : modal.type === "source"
                  ? "자료 제목"
                  : modal.type === "mission"
                    ? "미션 이름"
                    : "무엇을 할까요?"}
              <input
                autoFocus
                required
                maxLength={200}
                name="title"
                defaultValue={
                  task?.title ??
                  goal?.title ??
                  (modal.type === "quest" && source
                    ? `${source.title} 핵심 정리하기`
                    : source?.title) ??
                  (modal.type === "mission"
                    ? state.missions.find((m) => m.week === weekKey(today))
                        ?.title
                    : "")
                }
                placeholder="예: JOIN 예제 3개 풀고 차이 정리하기"
              />
            </label>
            {modal.type === "source" ? (
              <>
                <label>
                  자료 링크
                  <input
                    name="url"
                    type="url"
                    maxLength={2000}
                    defaultValue={source?.url}
                    placeholder="https://"
                  />
                </label>
                <label>
                  핵심 요약
                  <textarea
                    name="summary"
                    maxLength={2000}
                    rows={3}
                    defaultValue={source?.summary}
                  />
                </label>
                {goalSelect(source?.goalId)}
              </>
            ) : modal.type === "mission" ? (
              <>
                <label>
                  이번 주 완료할 퀘스트 수
                  <input
                    name="target"
                    type="number"
                    min={1}
                    max={100}
                    required
                    defaultValue={
                      state.missions.find((m) => m.week === weekKey(today))
                        ?.target ?? 5
                    }
                  />
                </label>
                {goalSelect(
                  state.missions.find((m) => m.week === weekKey(today))?.goalId,
                )}
              </>
            ) : (
              <>
                <label>
                  {modal.type === "goal"
                    ? "목표 범위 / 완료 기준"
                    : "어떻게 마무리할까요?"}
                  <textarea
                    name="description"
                    maxLength={2000}
                    rows={2}
                    defaultValue={
                      task?.description ?? goal?.description ?? source?.summary
                    }
                  />
                </label>
                <div className="v2-form-row">
                  {categorySelect(task?.category ?? goal?.category)}
                  <label>
                    {modal.type === "goal"
                      ? "전체 예상 학습량(분)"
                      : "예상 시간(분)"}
                    <input
                      required
                      name="minutes"
                      type="number"
                      min={modal.type === "goal" ? 15 : 5}
                      max={modal.type === "goal" ? 100000 : 480}
                      defaultValue={
                        task?.estimatedMinutes ??
                        goal?.totalMinutes ??
                        (modal.type === "goal" ? 600 : 30)
                      }
                    />
                  </label>
                </div>
                {modal.type === "goal" ? (
                  <>
                    <div className="v2-form-row">
                      <label>
                        마감일
                        <input
                          required
                          name="deadline"
                          type="date"
                          defaultValue={goal?.deadline ?? addDays(today, 14)}
                        />
                      </label>
                      <label>
                        현재 수준
                        <select
                          name="level"
                          defaultValue={goal?.level ?? "기초부터 시작"}
                        >
                          <option>기초부터 시작</option>
                          <option>기초 있음</option>
                          <option>실전 연습 중</option>
                        </select>
                      </label>
                    </div>
                    {goal && (
                      <label className="v2-checkbox">
                        <input
                          name="archived"
                          type="checkbox"
                          defaultChecked={goal.archived}
                        />
                        이 목표 보관하기 (새 배치에서 제외)
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    {goalSelect(task?.goalId ?? source?.goalId)}
                    <label>
                      개별 마감일 (선택)
                      <input
                        name="deadline"
                        type="date"
                        defaultValue={task?.deadline}
                      />
                    </label>
                    <label className="v2-checkbox">
                      <input
                        type="checkbox"
                        checked={locked}
                        onChange={(e) => setLocked(e.target.checked)}
                      />
                      시간을 직접 정하고 고정할게요
                    </label>
                    <div className="v2-form-row">
                      <label>
                        {locked ? "고정 날짜" : "시작 가능한 날짜"}
                        <input
                          name="date"
                          type="date"
                          required={locked}
                          defaultValue={
                            task?.scheduledStart
                              ? dateKey(
                                  task.scheduledStart,
                                  state.settings.timeZone,
                                )
                              : (task?.notBefore ?? today)
                          }
                        />
                      </label>
                      {locked && (
                        <label>
                          고정 시간
                          <input
                            name="time"
                            type="time"
                            required
                            defaultValue={
                              task?.scheduledStart
                                ? clockLabel(
                                    task.scheduledStart,
                                    state.settings.timeZone,
                                  )
                                : "19:00"
                            }
                          />
                        </label>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <p className="v2-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="v2-dialog-actions">
          <Button secondary disabled={busy} onClick={onClose}>
            돌아가기
          </Button>
          <Button type="submit" disabled={busy} icon="check">
            {busy
              ? "저장하고 있어요…"
              : modal.type === "complete"
                ? "완료하고 경험치 받기"
                : modal.type === "postpone"
                  ? "이 날짜로 미루기"
                  : "저장하고 계획에 반영"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
