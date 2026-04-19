"use client";

import { useState } from "react";

import { readApiMessage } from "@/lib/api-response";
import { type GoalInput, type GoalPlan } from "@/lib/types";
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

export function GoalPlannerForm() {
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [errors, setErrors] = useState<Partial<Record<GoalField, string>>>({});

  function updateField<K extends keyof GoalInput>(key: K, value: GoalInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
          persist
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

      const payload = (await response.json()) as { plan: GoalPlan; saved?: boolean };
      setPlan(payload.plan);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <section className="glass rounded-[2rem] p-6">
        <p className="text-sm text-slate-500">Step 1</p>
        <h2 className="section-title mt-1 text-2xl font-black text-ocean">목표 입력</h2>
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
            disabled={saving || !plan}
            onClick={() => requestPlan(true)}
            className="rounded-full border border-ocean/10 bg-white px-5 py-3 text-sm font-semibold text-ocean transition hover:bg-white/80 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "플랜 저장"}
          </button>
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
