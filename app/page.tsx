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

export default async function HomePage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="noise-overlay min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass flex flex-col gap-4 rounded-[2rem] px-5 py-5 shadow-glow md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="section-title text-2xl font-black tracking-[-0.08em] text-ocean">ILQue</p>
            <p className="mt-1 text-sm text-slate-500">듀오링고 느낌의 자격증/공부 퀘스트 플래너</p>
          </div>
          <GoogleSignInButton authConfigured={has.auth} />
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-12">
          <div className="rounded-[2.4rem] bg-ocean px-6 py-8 text-white shadow-glow md:px-8 md:py-10">
            <p className="text-xs uppercase tracking-[0.28em] text-white/70">Google Calendar + AI + XP System</p>
            <h1 className="section-title mt-4 max-w-3xl text-5xl font-black tracking-[-0.08em] md:text-7xl">
              오늘 해야 할 공부를
              <br />
              퀘스트처럼 보이게.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/78">
              ILQue는 캘린더에 적어둔 학습 이벤트를 오늘의 퀘스트로 바꾸고, 완료 흐름을 XP와 스트릭으로
              보여주는 학습 운영 대시보드입니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <GoogleSignInButton authConfigured={has.auth} />
              <a
                href="#preview"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90"
              >
                화면 미리 보기
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="glass rounded-[2rem] p-6">
              <p className="text-sm text-slate-500">멀티 유저 설계</p>
              <h2 className="section-title mt-2 text-3xl font-black text-ocean">각자 캘린더, 각자 데이터</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Google OAuth로 로그인한 뒤 본인 일정만 읽고, 완료 이력과 XP도 사용자별로 분리 저장하도록
                구조를 잡았습니다.
              </p>
            </div>
            <div className="glass rounded-[2rem] p-6">
              <p className="text-sm text-slate-500">현재 상태</p>
              <div className="mt-4 grid gap-3">
                <StatusCard label="OAuth" value={has.auth ? "연결 준비됨" : "환경 변수 필요"} />
                <StatusCard label="Supabase" value={has.supabase ? "연결 준비됨" : "환경 변수 필요"} />
                <StatusCard label="Google AI" value={has.ai ? "연결 준비됨" : "로컬 플랜 사용"} />
              </div>
            </div>
          </div>
        </section>

        <section id="preview" className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className={`glass rounded-[2rem] p-6 transition md:min-h-[220px] ${
                index === 1 ? "md:-translate-y-3" : ""
              }`}
            >
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Feature {index + 1}</p>
              <h3 className="section-title mt-3 text-2xl font-black text-ocean">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.body}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/80 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 font-semibold text-slate-700">{value}</p>
    </div>
  );
}
