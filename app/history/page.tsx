import { SiteShell } from "@/components/layout/site-shell";
import { getHistoryEntries, getUserStats } from "@/lib/app-data";
import { getViewer } from "@/lib/auth";

const categoryColor = {
  sql: "bg-blue-50 text-blue-700",
  coding: "bg-orange-50 text-orange-700",
  study: "bg-emerald-50 text-emerald-700",
  review: "bg-yellow-50 text-yellow-700"
} as const;

export default async function HistoryPage() {
  const viewer = await getViewer();
  const [history, stats] = await Promise.all([getHistoryEntries(viewer.id), getUserStats(viewer.id)]);

  return (
    <SiteShell
      currentTab="history"
      viewer={viewer}
      title="완료 기록과 XP 히스토리"
      subtitle="최근 완료 이력을 빠르게 훑고, 어떤 종류의 퀘스트를 얼마나 누적했는지 확인하는 공간입니다."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">한눈에 보기</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            <StatCard label="누적 XP" value={`${stats.xp} xp`} />
            <StatCard label="레벨" value={`Lv.${stats.level}`} />
            <StatCard label="스트릭" value={`${stats.streak} days`} />
          </div>
        </section>

        <section className="glass rounded-[2rem] p-6">
          <p className="text-sm text-slate-500">최근 완료 이력</p>
          <div className="mt-5 space-y-3">
            {history.map((entry) => (
              <article key={entry.id} className="rounded-[1.5rem] bg-white/80 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{entry.questTitle}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Intl.DateTimeFormat("ko-KR", {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }).format(new Date(entry.completedAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-2 text-sm font-semibold ${categoryColor[entry.category]}`}>
                      {entry.category}
                    </span>
                    <span className="rounded-full bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
                      +{entry.xpEarned} XP
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white/80 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="section-title mt-3 text-3xl font-black text-ocean">{value}</p>
    </div>
  );
}
