import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { SiteShell } from "@/components/layout/site-shell";
import { getDashboardSnapshot } from "@/lib/app-data";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <SiteShell
      currentTab="dashboard"
      viewer={snapshot.viewer}
      title="오늘의 퀘스트 대시보드"
      subtitle="캘린더 일정과 주간 미션을 오늘의 행동 단위로 쪼개고, 완료 즉시 XP 흐름까지 이어지게 구성했습니다."
    >
      <DashboardClient snapshot={snapshot} />
    </SiteShell>
  );
}
