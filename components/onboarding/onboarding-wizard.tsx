"use client";

import Link from "next/link";
import { useState } from "react";

import { readApiError } from "@/lib/api-response";
import { createManualQuestPreview } from "@/lib/mock-data";
import { type Quest } from "@/lib/types";
import { cn } from "@/lib/utils";

type Feedback = {
  type: "success" | "error";
  text: string;
};

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("자격증 준비");
  const [dailyHours, setDailyHours] = useState("2시간");
  const [startTime, setStartTime] = useState("19:00");
  const [manualTitle, setManualTitle] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualQuests, setManualQuests] = useState<Quest[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function addManualQuest() {
    const title = manualTitle.trim();

    if (!title) {
      setManualError("값을 입력해주세요.");
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);
    setManualError(null);
    setFeedback(null);

    try {
      const response = await fetch("/api/quests/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description: "온보딩에서 직접 입력한 퀘스트"
        })
      });

      if (!response.ok) {
        const { message, fieldErrors } = await readApiError(
          response,
          "수동 퀘스트를 추가하지 못했습니다. 잠시 후 다시 시도해주세요."
        );
        const titleError = fieldErrors.title?.[0];

        if (titleError) {
          setManualError(titleError);
          setFeedback(null);
        } else {
          setManualError(null);
          setFeedback({
            type: "error",
            text: message
          });
        }

        return;
      }

      const payload = (await response.json()) as {
        quest?: Quest;
      };

      setManualQuests((current) => [...current, payload.quest ?? createManualQuestPreview(title)]);
      setManualTitle("");
      setFeedback({
        type: "success",
        text: "수동 퀘스트를 추가했어요. 이제 대시보드로 이동할 수 있습니다."
      });
    } catch {
      setManualError("다시 시도해주세요.");
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
      <aside className="glass rounded-[2rem] p-6">
        <p className="text-sm text-slate-500">온보딩 플로우</p>
        <div className="mt-5 space-y-3">
          {[1, 2, 3].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStep(item)}
              className={`flex w-full items-center justify-between rounded-[1.25rem] px-4 py-4 text-left transition ${
                step === item ? "bg-ocean text-white" : "bg-white/80 text-slate-600"
              }`}
            >
              <span>Step {item}</span>
              <span>{item === 1 ? "목표 설정" : item === 2 ? "캘린더 연결" : "수동 퀘스트"}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="glass rounded-[2rem] p-6">
        {step === 1 ? (
          <div>
            <p className="text-sm text-slate-500">Step 1</p>
            <h2 className="section-title mt-1 text-2xl font-black text-ocean">공부 리듬부터 정하기</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Field label="공부 목적">
                <input
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="w-full rounded-[1.2rem] border border-ocean/10 bg-white/90 px-4 py-3"
                />
              </Field>
              <Field label="하루 가용 시간">
                <input
                  value={dailyHours}
                  onChange={(event) => setDailyHours(event.target.value)}
                  className="w-full rounded-[1.2rem] border border-ocean/10 bg-white/90 px-4 py-3"
                />
              </Field>
              <Field label="시작 시간">
                <input
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="w-full rounded-[1.2rem] border border-ocean/10 bg-white/90 px-4 py-3"
                />
              </Field>
            </div>
            <div className="mt-6 rounded-[1.5rem] bg-cream p-5 text-sm leading-6 text-slate-600">
              {goal} 기준으로 매일 {startTime}부터 {dailyHours} 정도 확보하면 퀘스트 자동 생성 흐름을 연결하기 좋습니다.
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
            >
              다음 단계로
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <p className="text-sm text-slate-500">Step 2</p>
            <h2 className="section-title mt-1 text-2xl font-black text-ocean">Google Calendar에 학습 시간 넣기</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.5rem] bg-white/85 p-5">
                <h3 className="font-bold text-slate-900">A. 지금 캘린더에 등록하러 가기</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  저녁 루틴, 메인 공부 블록, 주간 미션 이벤트만 넣어도 오늘 퀘스트를 자동으로 뽑아낼 수 있어요.
                </p>
                <a
                  href="https://calendar.google.com/calendar/u/0/r"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white"
                >
                  Calendar 열기
                </a>
              </article>
              <article className="rounded-[1.5rem] bg-white/85 p-5">
                <h3 className="font-bold text-slate-900">B. 오늘은 수동 퀘스트만 만들기</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  캘린더를 나중에 연결해도 괜찮아요. 일단 오늘 해야 할 것만 등록해서 바로 대시보드로 들어갈 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="mt-4 rounded-full border border-ocean/10 bg-white px-4 py-2 text-sm font-semibold text-ocean"
                >
                  수동 퀘스트로 진행
                </button>
              </article>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
              >
                캘린더 등록했어요
              </Link>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-full border border-ocean/10 bg-white px-5 py-3 text-sm font-semibold text-ocean"
              >
                수동 생성으로 넘어가기
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <p className="text-sm text-slate-500">Step 3</p>
            <h2 className="section-title mt-1 text-2xl font-black text-ocean">오늘의 첫 퀘스트 직접 만들기</h2>
            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-start">
              <div className="flex-1">
                <input
                  value={manualTitle}
                  onChange={(event) => {
                    setManualTitle(event.target.value);
                    if (manualError) {
                      setManualError(null);
                    }
                  }}
                  aria-invalid={Boolean(manualError)}
                  className={cn(
                    "w-full rounded-[1.2rem] border bg-white/90 px-4 py-3 transition outline-none",
                    manualError ? "border-red-400" : "border-ocean/10"
                  )}
                  placeholder="예: SQL 서브쿼리 복습"
                />
                {manualError ? <p className="mt-2 text-sm text-red-500">{manualError}</p> : null}
              </div>
              <button
                type="button"
                onClick={addManualQuest}
                disabled={isSubmitting}
                className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? "추가 중..." : "퀘스트 추가"}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {manualQuests.map((quest) => (
                <div key={quest.id} className="rounded-[1.4rem] bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{quest.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{quest.description}</p>
                    </div>
                    <span className="rounded-full bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
                      {quest.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {feedback ? (
              <div
                className={cn(
                  "mt-4 rounded-[1.2rem] px-4 py-3 text-sm font-medium",
                  feedback.type === "success"
                    ? "bg-green-600 text-white"
                    : "bg-red-50 text-red-700"
                )}
              >
                {feedback.text}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white"
              >
                대시보드로 이동
              </Link>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full border border-ocean/10 bg-white px-5 py-3 text-sm font-semibold text-ocean"
              >
                캘린더 연결 다시 보기
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
