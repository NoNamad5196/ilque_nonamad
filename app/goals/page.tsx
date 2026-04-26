import { GoalPlannerForm } from "@/components/goals/goal-planner-form";
import { SiteShell } from "@/components/layout/site-shell";
import { getViewer } from "@/lib/auth";
import { getSavedGoals } from "@/lib/app-data";

export default async function GoalsPage() {
  const viewer = await getViewer();
  const savedGoals = await getSavedGoals(viewer.id);

  return (
    <SiteShell
      currentTab="goals"
      viewer={viewer}
      title="목표 설정과 AI 플랜 생성"
      subtitle="캘린더 유무와 상관없이 목표를 먼저 넣고, 기간별 학습 계획을 자동 설계하는 탭입니다."
    >
      <GoalPlannerForm initialSavedGoals={savedGoals} />
    </SiteShell>
  );
}
