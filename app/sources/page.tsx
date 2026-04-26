import Link from "next/link";

import { SiteShell } from "@/components/layout/site-shell";
import { SourceQuestGenerator } from "@/components/sources/source-quest-generator";
import { getViewer } from "@/lib/auth";
import { has } from "@/lib/env";
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

  return (
    <SiteShell
      currentTab="sources"
      viewer={viewer}
      title="Notion 자료실"
      subtitle="Notion은 ILQue의 외부 기억장입니다. Sources는 자료, Goals는 목표 플랜, Missions는 큰 방향, Quests는 완료 기록으로 나눠 관리합니다."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="glass rounded-[2rem] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-500">Notion 연결</p>
              <h2 className="section-title mt-2 text-3xl font-black text-ocean">
                {notionSummary.connected ? "기록 준비 완료" : "연결 확인 필요"}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                {notionSummary.connected
                  ? "앱에서 만든 기록은 Notion ILQue 데이터베이스에도 같이 남습니다."
                  : has.notion
                    ? "환경 변수는 들어가 있지만 Notion API 응답을 확인하지 못했습니다."
                    : "NOTION_TOKEN과 NOTION_DATABASE_ID를 먼저 설정해야 합니다."}
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                notionSummary.connected ? "bg-sage text-green-800" : "bg-slate-100 text-slate-500"
              }`}
            >
              {notionSummary.connected ? "연결됨" : "대기"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {notionCards.map((card) => (
              <article key={card.type} className="rounded-[1.5rem] bg-white/80 p-5">
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

        <section className="glass rounded-[2rem] p-6">
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

      <section className="glass mt-6 rounded-[2rem] p-6">
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
              <article key={record.id} className="rounded-[1.5rem] bg-white/80 p-5">
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
          <div className="mt-5 rounded-[1.5rem] bg-white/80 p-6 text-sm leading-6 text-slate-600">
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
    <article className="rounded-[1.5rem] bg-white/80 p-5">
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
