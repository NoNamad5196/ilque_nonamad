import { SiteShell } from "@/components/layout/site-shell";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getViewer } from "@/lib/auth";

export default async function OnboardingPage() {
  const viewer = await getViewer();

  return (
    <SiteShell
      currentTab="dashboard"
      viewer={viewer}
      title="온보딩과 첫 퀘스트 만들기"
      subtitle="캘린더가 비어 있거나 오늘 일정이 없을 때, 목표 설정과 수동 퀘스트 입력으로 첫 화면을 채우는 흐름입니다."
    >
      <OnboardingWizard />
    </SiteShell>
  );
}
