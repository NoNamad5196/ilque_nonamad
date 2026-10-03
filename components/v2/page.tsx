import { getViewer } from "@/lib/auth";
import { LearningApp, type View } from "./learning-app";
export async function LearningPage({ view }: { view: View }) {
  const viewer = await getViewer();
  return <LearningApp view={view} viewer={viewer} />;
}
