import { SiteShell } from "@/components/layout/site-shell";
import { getUserStats } from "@/lib/app-data";
import { getViewer } from "@/lib/auth";

export default async function ProfilePage() {
  const viewer = await getViewer();
  const stats = await getUserStats(viewer.id);
  const levelProgress = stats.xp % 100;
  const xpToNextLevel = levelProgress === 0 ? 100 : 100 - levelProgress;

  return (
    <SiteShell
      currentTab="profile"
      viewer={viewer}
      title="프로필"
      subtitle="내 학습 페이스와 누적 기록을 확인하는 공간입니다."
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="glass rounded-2xl p-6">
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

        <section className="glass rounded-2xl p-6">
          <p className="text-sm text-slate-500">학습 리듬</p>
          <h2 className="mt-2 text-2xl font-black text-ocean">현재 페이스</h2>
          <div className="mt-5 space-y-3">
            <RhythmRow
              title="다음 레벨까지"
              value={`${xpToNextLevel} XP`}
              body="퀘스트를 완료하면 바로 누적 XP에 반영됩니다."
            />
            <RhythmRow
              title="스트릭"
              value={`${stats.streak}일`}
              body="하루에 한 번이라도 완료하면 흐름이 이어집니다."
            />
            <RhythmRow
              title="최근 완료일"
              value={stats.lastCompletedDate ?? "아직 없음"}
              body="완료 기록이 쌓이면 오늘의 루틴을 더 쉽게 조정할 수 있습니다."
            />
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="section-title mt-3 text-3xl font-black text-ocean">{value}</p>
    </div>
  );
}

function RhythmRow({
  title,
  body,
  value
}: {
  title: string;
  body: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-white/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        </div>
        <span className="shrink-0 rounded-full bg-ocean/10 px-3 py-2 text-sm font-semibold text-ocean">
          {value}
        </span>
      </div>
    </div>
  );
}
