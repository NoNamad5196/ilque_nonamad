import { SiteShell } from "@/components/layout/site-shell";
import { getUserStats } from "@/lib/app-data";
import { getViewer } from "@/lib/auth";
import { has } from "@/lib/env";

export default async function ProfilePage() {
  const viewer = await getViewer();
  const stats = await getUserStats(viewer.id);

  return (
    <SiteShell
      currentTab="profile"
      viewer={viewer}
      title="프로필과 연결 설정"
      subtitle="현재 학습 상태와 연결 구성을 확인하고, 앱이 어떤 서비스와 이어져 있는지 빠르게 파악할 수 있습니다."
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">내 프로필</p>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-coral to-apricot text-2xl font-black text-white">
              {viewer.name.slice(0, 1)}
            </div>
            <div>
              <h2 className="section-title text-3xl font-black text-ocean">{viewer.name}</h2>
              <p className="mt-2 text-sm text-slate-500">{viewer.email || "이메일 정보 없음"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card label="XP" value={`${stats.xp}`} />
            <Card label="Level" value={`${stats.level}`} />
            <Card label="Streak" value={`${stats.streak}`} />
          </div>
        </section>

        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">연결 체크리스트</p>
          <div className="mt-5 space-y-3">
            <ChecklistRow title="Google OAuth" body="로그인과 Calendar 읽기 권한" ready={has.auth} />
            <ChecklistRow title="Supabase" body="사용자 프로필, 완료 이력, 목표 플랜 저장" ready={has.supabase} />
            <ChecklistRow title="Google AI" body="퀘스트 변환과 목표 플랜 생성 응답" ready={has.ai} />
            <ChecklistRow title="Notion" body="개인 ILQue 데이터베이스 기록 연동" ready={has.notion} />
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white/80 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="section-title mt-3 text-3xl font-black text-ocean">{value}</p>
    </div>
  );
}

function ChecklistRow({
  title,
  body,
  ready
}: {
  title: string;
  body: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        </div>
        <span
          className={`rounded-full px-3 py-2 text-sm font-semibold ${
            ready ? "bg-sage text-green-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {ready ? "준비됨" : "미설정"}
        </span>
      </div>
    </div>
  );
}
