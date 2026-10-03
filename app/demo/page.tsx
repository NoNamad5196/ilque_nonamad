import { LearningApp, type View } from "@/components/v2/learning-app";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const views: View[] = [
    "today",
    "quests",
    "goals",
    "missions",
    "sources",
    "history",
    "plan",
    "settings",
  ];
  const view = views.includes(params.view as View)
    ? (params.view as View)
    : "today";
  return (
    <LearningApp key={view} view={view} viewer={{ name: "학습자" }} demo />
  );
}
