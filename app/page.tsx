import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { getServerAuthSession } from "@/lib/auth";
import { has } from "@/lib/env";

const features = [
  {
    title: "Calendar to Quest",
    body: "Google Calendar 이벤트를 읽어 오늘의 학습 퀘스트로 변환합니다."
  },
  {
    title: "XP + Streak",
    body: "퀘스트를 끝낼 때마다 XP가 쌓이고, 연속 학습 흐름을 스트릭으로 보여줍니다."
  },
  {
    title: "AI Goal Planner",
    body: "목표 기간과 현재 수준을 넣으면 주차별 계획을 바로 설계합니다."
  }
];

const previewQuests = [
  { label: "09:00", title: "SQL 조인 복습", meta: "35분 · 40 XP" },
  { label: "11:30", title: "오답 노트 정리", meta: "25분 · 25 XP" },
  { label: "15:00", title: "모의 문제 20개", meta: "50분 · 60 XP" }
];

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen px-4 py-5 md:px-8 md:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-ocean/10 pb-4">
          <div className="flex items-center gap-3">
            <img src="/ilque-icon.png" alt="ILQue 아이콘" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <p className="text-2xl font-black text-ocean">ILQue</p>
              <p className="text-sm text-slate-500">자격증 공부 퀘스트 플래너</p>
            </div>
          </div>
          <GoogleSignInButton authConfigured={has.auth} />
        </header>

        <section className="py-8 md:py-10">
          <div className="relative overflow-hidden rounded-3xl bg-ocean px-6 py-9 text-white shadow-sm md:px-9 md:py-11">
            <img
              src="/ilque-icon.png"
              alt=""
              aria-hidden="true"
              className="absolute right-6 top-6 h-28 w-28 rounded-3xl object-cover opacity-15"
            />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold text-white/70">Daily Quest Planner</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-6xl">
                오늘 공부를 바로 실행 가능한 퀘스트로.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
                캘린더에 흩어진 학습 일정을 오늘 끝낼 수 있는 단위로 정리하고, 완료 기록과 XP를 한 화면에서
                이어갑니다.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <GoogleSignInButton authConfigured={has.auth} />
                <a
                  href="#preview"
                  className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  화면 미리 보기
                </a>
              </div>
            </div>

            <div className="relative mt-9 grid gap-3 md:grid-cols-3">
              {previewQuests.map((quest) => (
                <div key={quest.title} className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-sm font-semibold text-white/60">{quest.label}</p>
                  <h2 className="mt-3 text-lg font-bold">{quest.title}</h2>
                  <p className="mt-2 text-sm text-white/65">{quest.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preview" className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="glass rounded-2xl p-6">
              <h3 className="text-xl font-black text-ocean">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.body}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
