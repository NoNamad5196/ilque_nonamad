"use client";

import { useState } from "react";

import { readApiMessage } from "@/lib/api-response";
import { type GoalInput, type GoalPlan, type SavedGoal } from "@/lib/types";
import { cn } from "@/lib/utils";

type Feedback = {
  type: "success" | "error";
  text: string;
};

type GoalField = "category" | "title" | "durationLabel" | "durationDays";

const presets = [
  { label: "3일", days: 3 },
  { label: "1주", days: 7 },
  { label: "2주", days: 14 },
  { label: "1개월", days: 30 },
  { label: "3개월", days: 90 }
] as const;

export function GoalPlannerForm({
  initialSavedGoals
}: {
  initialSavedGoals: SavedGoal[];
}) {
  const [form, setForm] = useState<GoalInput>({
    category: "자격증",
    title: "ADsP 취득",
    durationLabel: "3주",
    durationDays: 21,
    dailyHours: "2",
    currentLevel: "완전 처음"
  });
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [savedGoals, setSavedGoals] = useState(initialSavedGoals);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingGoalTitle, setEditingGoalTitle] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [revisionRequest, setRevisionRequest] = useState("");
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<Partial<Record<GoalField, string>>>({});

  function updateField<K extends keyof GoalInput>(key: K, value: GoalInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (plan) {
      setPlan(null);
    }
    if (key in errors) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function validateForm() {
    const nextErrors: Partial<Record<GoalField, string>> = {};

    if (!form.category.trim()) {
      nextErrors.category = "값을 입력해주세요.";
    }

    if (!form.title.trim()) {
      nextErrors.title = "값을 입력해주세요.";
    }

    if (!form.durationLabel.trim()) {
      nextErrors.durationLabel = "값을 입력해주세요.";
    }

    if (!Number.isFinite(form.durationDays) || form.durationDays < 1) {
      nextErrors.durationDays = "1일 이상 입력해주세요.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function requestPlan(persist = false) {
    if (!validateForm()) {
      setFeedback({
        type: "error",
        text: "입력값을 다시 확인해주세요."
      });
      return;
    }

    setLoading(!persist);
    setSaving(persist);
    setFeedback(null);

    try {
      if (persist && editingGoalId) {
        const response = await fetch(`/api/goals/${editingGoalId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ...form,
            category: form.category.trim(),
            title: form.title.trim(),
            durationLabel: form.durationLabel.trim(),
            ...(plan ? { plan } : {})
          })
        });

        if (!response.ok) {
          const message = await readApiMessage(response, "목표를 수정하지 못했습니다.");

          setFeedback({
            type: "error",
            text: message
          });
          return;
        }

        const payload = (await response.json()) as {
          plan: GoalPlan;
          savedGoal: SavedGoal;
        };

        setPlan(payload.plan);
        setSavedGoals((current) =>
          current.map((goal) => (goal.id === payload.savedGoal.id ? payload.savedGoal : goal))
        );
        setEditingGoalId(null);
        setEditingGoalTitle(null);
        setFeedback({
          type: "success",
          text: "목표와 AI 플랜을 수정 저장했습니다."
        });
        return;
      }

      const response = await fetch("/api/goals/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          category: form.category.trim(),
          title: form.title.trim(),
          durationLabel: form.durationLabel.trim(),
          persist,
          ...(persist && plan ? { plan } : {})
        })
      });

      if (!response.ok) {
        const message = await readApiMessage(
          response,
          persist ? "플랜을 저장하지 못했습니다." : "플랜을 생성하지 못했습니다."
        );

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as {
        plan: GoalPlan;
        saved?: boolean;
        savedGoal?: SavedGoal;
      };

      setPlan(payload.plan);

      if (payload.savedGoal) {
        setSavedGoals((current) => [
          payload.savedGoal as SavedGoal,
          ...current.filter((goal) => goal.id !== payload.savedGoal?.id)
        ]);
      }

      setFeedback({
        type: "success",
        text: persist ? "플랜을 저장해두었어요." : "플랜을 새로 생성했어요."
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setLoading(false);
      setSaving(false);
    }
  }

  async function refineCurrentPlan() {
    const instruction = revisionRequest.trim();

    if (!plan) {
      setFeedback({
        type: "error",
        text: "먼저 AI 플랜을 생성하거나 저장한 플랜을 불러와주세요."
      });
      return;
    }

    if (!instruction) {
      setFeedback({
        type: "error",
        text: "수정 요청을 입력해주세요."
      });
      return;
    }

    if (!validateForm()) {
      setFeedback({
        type: "error",
        text: "목표 입력값을 먼저 확인해주세요."
      });
      return;
    }

    setRevising(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/goals/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          category: form.category.trim(),
          title: form.title.trim(),
          durationLabel: form.durationLabel.trim(),
          plan,
          instruction
        })
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "플랜 수정 요청을 반영하지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as { plan: GoalPlan };

      setPlan(payload.plan);
      setRevisionRequest("");
      setFeedback({
        type: "success",
        text: "수정 요청을 반영해서 플랜을 다시 정리했습니다."
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setRevising(false);
    }
  }

  async function deleteSavedGoal(goal: SavedGoal) {
    const confirmed = window.confirm(`'${goal.title}' 목표를 삭제할까요? Notion 기록도 같이 정리합니다.`);

    if (!confirmed) {
      return;
    }

    setDeletingGoalId(goal.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "목표를 삭제하지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      setSavedGoals((current) => current.filter((item) => item.id !== goal.id));
      setFeedback({
        type: "success",
        text: "저장한 목표를 삭제했습니다."
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setDeletingGoalId(null);
    }
  }

  async function createManualQuest() {
    const title = manualTitle.trim();

    if (!title) {
      setFeedback({
        type: "error",
        text: "수동 퀘스트 이름을 입력해주세요."
      });
      return;
    }

    setManualLoading(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/quests/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title })
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "수동 퀘스트를 추가하지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      setManualTitle("");
      setFeedback({
        type: "success",
        text: `"${title}" 퀘스트를 추가했습니다. 대시보드와 Notion Quests에 반영됩니다.`
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setManualLoading(false);
    }
  }

  function editSavedGoal(goal: SavedGoal) {
    setForm({
      category: goal.category,
      title: goal.title,
      durationLabel: formatDurationLabel(goal.durationDays),
      durationDays: goal.durationDays,
      dailyHours: String(goal.dailyHours || 2),
      currentLevel: goal.level
    });
    setPlan(goal.plan);
    setEditingGoalId(goal.id);
    setEditingGoalTitle(goal.title);
    setFeedback({
      type: "success",
      text: "저장한 목표를 입력창에 불러왔습니다. 수정 후 다시 저장할 수 있어요."
    });
  }

  function cancelEdit() {
    setEditingGoalId(null);
    setEditingGoalTitle(null);
    setFeedback({
      type: "success",
      text: "목표 수정 모드를 종료했습니다."
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">Step 1</p>
          <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="section-title text-2xl font-black text-ocean">목표 입력</h2>
            {editingGoalId ? (
              <span className="w-fit rounded-full bg-apricot/30 px-3 py-1 text-xs font-bold text-ocean">
                수정 중: {editingGoalTitle}
              </span>
            ) : null}
          </div>
          <GoalEditShortcut
            goals={savedGoals}
            editingGoalId={editingGoalId}
            onEdit={editSavedGoal}
          />
          <div className="mt-6 space-y-4">
            <Field label="목표 종류" error={errors.category}>
              <input
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                aria-invalid={Boolean(errors.category)}
                className={inputClassName(Boolean(errors.category))}
              />
            </Field>
            <Field label="목표 이름" error={errors.title}>
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                aria-invalid={Boolean(errors.title)}
                className={inputClassName(Boolean(errors.title))}
              />
            </Field>
            <Field label="목표 기간" error={errors.durationLabel ?? errors.durationDays}>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      updateField("durationLabel", preset.label);
                      updateField("durationDays", preset.days);
                    }}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      form.durationDays === preset.days ? "bg-ocean text-white" : "bg-white text-slate-500"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  value={form.durationLabel}
                  onChange={(event) => updateField("durationLabel", event.target.value)}
                  aria-invalid={Boolean(errors.durationLabel)}
                  className={inputClassName(Boolean(errors.durationLabel))}
                  placeholder="예: 3주"
                />
                <input
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(event) => updateField("durationDays", Number(event.target.value) || 0)}
                  aria-invalid={Boolean(errors.durationDays)}
                  className={inputClassName(Boolean(errors.durationDays))}
                  placeholder="일 수"
                />
              </div>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="하루 가용 시간">
                <select
                  value={form.dailyHours}
                  onChange={(event) => updateField("dailyHours", event.target.value)}
                  className={inputClassName(false)}
                >
                  <option value="1">1시간 미만</option>
                  <option value="1.5">1~2시간</option>
                  <option value="2">2~3시간</option>
                  <option value="3">3시간 이상</option>
                </select>
              </Field>
              <Field label="현재 수준">
                <select
                  value={form.currentLevel}
                  onChange={(event) => updateField("currentLevel", event.target.value)}
                  className={inputClassName(false)}
                >
                  <option>완전 처음</option>
                  <option>기초 있음</option>
                  <option>어느 정도 앎</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => requestPlan(false)}
              className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white transition hover:bg-ocean/90 disabled:opacity-60"
            >
              {loading ? "플랜 생성 중..." : "AI 플랜 생성"}
            </button>
            <button
              type="button"
              disabled={saving || (!plan && !editingGoalId)}
              onClick={() => requestPlan(true)}
              className="rounded-full border border-ocean/10 bg-white px-5 py-3 text-sm font-semibold text-ocean transition hover:bg-white/80 disabled:opacity-60"
            >
              {editingGoalId
                ? saving
                  ? "수정 저장 중..."
                  : "수정 저장"
                : saving
                  ? "저장 중..."
                  : "현재 목표 저장"}
            </button>
            {editingGoalId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                수정 취소
              </button>
            ) : null}
          </div>
        </section>

        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">Step 2</p>
          <h2 className="section-title mt-1 text-2xl font-black text-ocean">AI 플랜 제안</h2>
          {plan ? (
            <div className="mt-6">
              <div className="rounded-[1.5rem] bg-white/85 p-5">
                <h3 className="section-title text-2xl font-black text-slate-900">{plan.summary}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{plan.advice}</p>
              </div>

              <div className="mt-4 space-y-4">
                {plan.weeks.map((week) => (
                  <article key={week.week} className="rounded-[1.5rem] bg-white/80 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Week {week.week}</p>
                        <h4 className="mt-2 text-xl font-bold text-slate-900">{week.theme}</h4>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {week.daily.map((day) => (
                        <div key={`${week.week}-${day.day}`} className="rounded-[1.2rem] bg-cream p-4">
                          <p className="font-semibold text-ocean">{day.day}</p>
                          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                            {day.tasks.map((task) => (
                              <li key={task}>• {task}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <PlanRevisionBox
                value={revisionRequest}
                loading={revising}
                onChange={setRevisionRequest}
                onSubmit={refineCurrentPlan}
              />
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-ocean/20 bg-white/60 p-6 text-sm leading-6 text-slate-500">
              목표를 입력하고 플랜을 생성하면, 주차별 테마와 요일별 학습 흐름을 여기서 바로 확인할 수 있습니다.
            </div>
          )}

          {feedback ? (
            <div
              className={cn(
                "mt-4 rounded-[1.2rem] px-4 py-3 text-sm font-medium",
                feedback.type === "success" ? "bg-ocean text-white" : "bg-red-50 text-red-700"
              )}
            >
              {feedback.text}
            </div>
          ) : null}
        </section>
      </div>

      <ManualQuestSection
        title={manualTitle}
        loading={manualLoading}
        onTitleChange={setManualTitle}
        onSubmit={createManualQuest}
      />

      <SavedGoalsSection
        goals={savedGoals}
        deletingGoalId={deletingGoalId}
        onView={(goal) => {
          setPlan(goal.plan);
          setFeedback({
            type: "success",
            text: "저장한 플랜을 불러왔습니다."
          });
        }}
        onEdit={editSavedGoal}
        onDelete={deleteSavedGoal}
      />
    </div>
  );
}

function Field({
  label,
  children,
  error
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </label>
  );
}

function inputClassName(hasError: boolean) {
  return cn(
    "w-full rounded-[1.2rem] border bg-white/90 px-4 py-3 outline-none transition focus:border-coral",
    hasError ? "border-red-400" : "border-ocean/10"
  );
}

function GoalEditShortcut({
  goals,
  editingGoalId,
  onEdit
}: {
  goals: SavedGoal[];
  editingGoalId: string | null;
  onEdit: (goal: SavedGoal) => void;
}) {
  const recentGoals = goals.slice(0, 3);

  return (
    <div className="mt-4 rounded-[1.5rem] border border-ocean/10 bg-white/70 p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-bold text-ocean">저장한 목표 수정</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            저장된 목표를 선택하면 입력창에 불러오고, 내용을 바꾼 뒤 `수정 저장`으로 덮어씁니다.
          </p>
        </div>
        {recentGoals.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {recentGoals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => onEdit(goal)}
                className={cn(
                  "rounded-full px-3 py-2 text-xs font-bold transition",
                  editingGoalId === goal.id
                    ? "bg-ocean text-white"
                    : "bg-apricot/40 text-ocean hover:bg-apricot/60"
                )}
              >
                {editingGoalId === goal.id ? "수정 중" : "수정"} · {goal.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-[1.2rem] bg-cream px-4 py-3 text-xs leading-5 text-slate-600">
            지금은 저장된 목표가 없어서 수정할 대상이 없습니다. 먼저 AI 플랜을 만들고 `현재 목표 저장`을 누르면 여기서 수정할 수 있어요.
          </p>
        )}
      </div>
    </div>
  );
}

function PlanRevisionBox({
  value,
  loading,
  onChange,
  onSubmit
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-5 rounded-[1.5rem] border border-coral/20 bg-coral/5 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-coral">이 플랜 수정 요청</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            마음에 안 드는 부분을 말하면, 현재 플랜을 기준으로 다시 다듬습니다.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-500">
          예: 문제풀이 위주로, 주말은 복습만
        </span>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 min-h-24 w-full resize-none rounded-[1.2rem] border border-coral/20 bg-white/90 px-4 py-3 text-sm leading-6 outline-none transition focus:border-coral"
        placeholder="예: 하루 1시간 기준으로 줄이고, 기출 문제 풀이 비중을 늘려줘."
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={onSubmit}
          className="rounded-full bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral/90 disabled:opacity-60"
        >
          {loading ? "다시 정리 중..." : "요청 반영해서 다시 생성"}
        </button>
      </div>
    </div>
  );
}

function SavedGoalsSection({
  goals,
  deletingGoalId,
  onView,
  onEdit,
  onDelete
}: {
  goals: SavedGoal[];
  deletingGoalId: string | null;
  onView: (goal: SavedGoal) => void;
  onEdit: (goal: SavedGoal) => void;
  onDelete: (goal: SavedGoal) => void;
}) {
  return (
    <section className="glass rounded-[2rem] p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-500">저장한 목표</p>
          <h2 className="section-title mt-1 text-2xl font-black text-ocean">AI 목표 보관함</h2>
        </div>
        <p className="text-sm text-slate-500">삭제하면 Notion Goal 기록도 같이 정리합니다.</p>
      </div>

      {goals.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <article key={goal.id} className="rounded-[1.5rem] bg-white/85 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-bold text-ocean">
                    {goal.category}
                  </span>
                  <h3 className="mt-3 text-xl font-black text-slate-900">{goal.title}</h3>
                </div>
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-slate-500">
                  {goal.dailyHours}h/day
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{goal.plan.summary}</p>
              <p className="mt-3 text-xs text-slate-400">
                {formatDate(goal.startDate)} - {formatDate(goal.endDate)} · {goal.level}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onView(goal)}
                  className="rounded-full bg-ocean px-4 py-2 text-sm font-bold text-white transition hover:bg-ocean/90"
                >
                  보기
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(goal)}
                  className="rounded-full bg-apricot/40 px-4 py-2 text-sm font-bold text-ocean transition hover:bg-apricot/60"
                >
                  수정
                </button>
                <button
                  type="button"
                  disabled={deletingGoalId === goal.id}
                  onClick={() => onDelete(goal)}
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                >
                  {deletingGoalId === goal.id ? "삭제 중..." : "삭제"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-ocean/20 bg-white/60 p-6 text-sm leading-6 text-slate-500">
          아직 저장한 AI 목표가 없습니다. 플랜을 생성한 뒤 `플랜 저장`을 누르면 여기에 쌓입니다.
        </div>
      )}
    </section>
  );
}

function ManualQuestSection({
  title,
  loading,
  onTitleChange,
  onSubmit
}: {
  title: string;
  loading: boolean;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="glass rounded-[2rem] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">빠른 추가</p>
          <h2 className="section-title mt-1 text-2xl font-black text-ocean">퀘스트 수동 추가</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            목표를 보다가 바로 떠오른 오늘 할 일을 퀘스트로 넣어둘 수 있습니다.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:max-w-md md:flex-row">
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSubmit();
              }
            }}
            className="min-w-0 flex-1 rounded-[1.2rem] border border-ocean/10 bg-white/90 px-4 py-3 outline-none transition focus:border-coral"
            placeholder="예: SQL 오답 10개 정리"
          />
          <button
            type="button"
            disabled={loading}
            onClick={onSubmit}
            className="rounded-full bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral/90 disabled:opacity-60"
          >
            {loading ? "추가 중..." : "퀘스트 추가"}
          </button>
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  return value.slice(5).replace("-", ".");
}

function formatDurationLabel(days: number) {
  if (days % 30 === 0) {
    return `${days / 30}개월`;
  }

  if (days % 7 === 0) {
    return `${days / 7}주`;
  }

  return `${days}일`;
}
