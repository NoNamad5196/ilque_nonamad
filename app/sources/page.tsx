import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { SourceQuestGenerator } from "@/components/sources/source-quest-generator";
import { getViewer } from "@/lib/auth";
import { getNotionWorkspaceSummary, type NotionRecordType } from "@/lib/notion/records";

const notionCards: Array<{
  type: NotionRecordType;
  label: string;
  title: string;
  body: string;
}> = [
  {
    type: "Source",
    label: "Sources",
    title: "자료 창고",
    body: "공식 문서, 강의 링크, PDF, 블로그 글처럼 퀘스트 재료가 될 자료를 모아둡니다."
  },
  {
    type: "Goal",
    label: "Goals",
    title: "목표 플랜",
    body: "목표 페이지에서 만든 AI 플랜을 저장하고, 나중에 다시 이어서 볼 수 있게 둡니다."
  },
  {
    type: "Mission",
    label: "Missions",
    title: "큰 방향",
    body: "이번 주 또는 이번 달에 밀고 갈 공부 방향과 미션을 정리하는 공간입니다."
  },
  {
    type: "Quest",
    label: "Quests",
    title: "완료 기록",
    body: "앱에서 완료한 퀘스트가 쌓이는 기록장입니다. XP와 완료 시각도 함께 남깁니다."
  }
];

export default async function SourcesPage() {
  const viewer = await getViewer();
  const notionSummary = await getNotionWorkspaceSummary();
  const totalRecords = Object.values(notionSummary.counts).reduce((sum, count) => sum + count, 0);

  return (
    <SiteShell
      currentTab="sources"
      viewer={viewer}
      title="학습 자료실"
      subtitle="공식 문서, 강의 링크, 목표 플랜, 완료 기록을 한곳에 모아서 다음 퀘스트의 재료로 씁니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass rounded-2xl p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-500">자료 저장소</p>
              <h2 className="mt-2 text-3xl font-black text-ocean">
                {totalRecords > 0 ? `${totalRecords}개의 학습 기록` : "학습 자료를 모아둘 공간"}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                {notionSummary.connected
                  ? "자료, 목표 플랜, 미션, 완료 기록을 나눠두고 필요한 항목만 빠르게 다시 꺼내봅니다."
                  : "자료실을 쓰기 위한 설정이 아직 끝나지 않았습니다. 설정이 완료되면 이 화면에 기록이 표시됩니다."}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {notionCards.map((card) => (
              <article key={card.type} className="rounded-2xl bg-white/80 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                  <span className="rounded-full bg-ocean/10 px-3 py-1 text-sm font-bold text-ocean">
                    {notionSummary.counts[card.type]}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-black text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {notionSummary.databaseUrl ? (
              <a
                href={notionSummary.databaseUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-ocean px-5 py-3 text-sm font-bold text-white transition hover:bg-ocean/90"
              >
                Notion ILQue 열기
              </a>
            ) : null}
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-cream"
            >
              NotebookLM 열기
            </a>
            <Link
              href="/goals"
              className="rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-cream"
            >
              목표 플랜 만들기
            </Link>
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <p className="text-sm text-slate-500">추천 사용법</p>
          <div className="mt-5 space-y-4">
            <FlowCard
              step="1"
              title="Sources에 자료를 모으기"
              body="공식 문서, 영상 링크, 에러 해결 기록처럼 다시 보고 싶은 자료만 적게 넣습니다."
            />
            <FlowCard
              step="2"
              title="ILQue가 퀘스트로 바꾸기"
              body="다음 단계에서는 Sources를 읽어서 오늘 할 퀘스트를 자동 생성하게 만들 수 있습니다."
            />
            <FlowCard
              step="3"
              title="NotebookLM에는 복사해서 넘기기"
              body="비공개 Notion 링크를 직접 넣기보다, 앱에서 요약 텍스트를 만들어 붙여넣는 방식이 안전합니다."
            />
          </div>
        </section>
      </div>

      <SourceQuestGenerator
        connected={notionSummary.connected}
        sourceCount={notionSummary.counts.Source}
      />

      <section className="glass mt-6 rounded-2xl p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">최근 Notion 항목</p>
            <h2 className="section-title mt-2 text-3xl font-black text-ocean">앱이 읽은 기록</h2>
          </div>
          <p className="text-sm text-slate-500">최대 8개까지 보여줍니다.</p>
        </div>

        {notionSummary.recent.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {notionSummary.recent.map((record) => (
              <article key={record.id} className="rounded-2xl bg-white/80 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-bold text-ocean">
                    {record.type}
                  </span>
                  {record.status ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                      {record.status}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-lg font-black text-slate-900">{record.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                  {record.summary || "요약이 아직 없습니다."}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-white/80 p-6 text-sm leading-6 text-slate-600">
            아직 Notion에 앱이 읽을 항목이 없습니다. 먼저 Notion의 `ILQue Sources`에 자료를 하나 넣거나,
            앱에서 퀘스트/목표 플랜을 저장해보면 여기에 표시됩니다.
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function FlowCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <article className="rounded-2xl bg-white/80 p-5">
      <div className="flex gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ocean text-sm font-black text-white">
          {step}
        </span>
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
        </div>
      </div>
    </article>
  );
}
