"use client";

import Link from "next/link";
import { useState } from "react";

import { readApiMessage } from "@/lib/api-response";
import { type LearningSource, type Quest, type WebSourceResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type Feedback = {
  type: "success" | "error" | "info";
  text: string;
};

const categoryLabel = {
  sql: "SQL",
  coding: "Coding",
  study: "Study",
  review: "Review"
} as const;

export function SourceQuestGenerator({
  connected,
  sourceCount
}: {
  connected: boolean;
  sourceCount: number;
}) {
  const [sources, setSources] = useState<LearningSource[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<WebSourceResult[]>([]);
  const [searchHtml, setSearchHtml] = useState("");
  const [savingSourceUrl, setSavingSourceUrl] = useState<string | null>(null);
  const [savedSourceUrls, setSavedSourceUrls] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function searchWebSources() {
    const query = searchQuery.trim();

    if (!query) {
      setFeedback({
        type: "error",
        text: "검색어를 입력해주세요."
      });
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);
    setSearchHtml("");
    setFeedback(null);

    try {
      const response = await fetch("/api/sources/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "웹 자료 검색에 실패했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as {
        results: WebSourceResult[];
        searchHtml?: string;
      };

      setSearchResults(payload.results);
      setSearchHtml(payload.searchHtml ?? "");
      setFeedback({
        type: "success",
        text: `${payload.results.length}개 웹 자료 후보를 찾았습니다. 필요한 것만 Sources에 저장하세요.`
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setSearchLoading(false);
    }
  }

  async function saveWebSource(result: WebSourceResult) {
    setSavingSourceUrl(result.url);
    setFeedback(null);

    try {
      const response = await fetch("/api/sources/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: result.title,
          url: result.url,
          summary: result.summary,
          category: result.category
        })
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "Notion Sources에 저장하지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      setSavedSourceUrls((current) => Array.from(new Set([...current, result.url])));
      setFeedback({
        type: "success",
        text: `"${result.title}" 자료를 Notion Sources에 저장했습니다.`
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setSavingSourceUrl(null);
    }
  }

  async function generateQuests() {
    setLoading(true);
    setSaved(false);
    setFeedback(null);

    try {
      const response = await fetch("/api/sources/quests", {
        method: "POST"
      });

      if (!response.ok) {
        const message = await readApiMessage(response, "자료 기반 퀘스트를 만들지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      const payload = (await response.json()) as {
        sources: LearningSource[];
        quests: Quest[];
      };

      setSources(payload.sources);
      setQuests(payload.quests);
      setFeedback({
        type: "success",
        text: `${payload.sources.length}개 자료에서 ${payload.quests.length}개 퀘스트 후보를 만들었습니다.`
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveQuests() {
    if (quests.length === 0) {
      return;
    }

    setSaving(true);
    setFeedback({
      type: "info",
      text: "퀘스트를 대시보드에 추가하는 중입니다."
    });

    try {
      const results = await Promise.all(
        quests.map((quest) =>
          fetch("/api/quests/manual", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              title: quest.title,
              description: `Notion Sources 기반 퀘스트입니다.\n${quest.description}`,
              category: quest.category
            })
          })
        )
      );

      const failed = results.find((response) => !response.ok);

      if (failed) {
        const message = await readApiMessage(failed, "일부 퀘스트를 추가하지 못했습니다.");

        setFeedback({
          type: "error",
          text: message
        });
        return;
      }

      setSaved(true);
      setFeedback({
        type: "success",
        text: "자료 기반 퀘스트를 대시보드에 추가했습니다."
      });
    } catch {
      setFeedback({
        type: "error",
        text: "서버와 통신하지 못했습니다. 잠시 후 다시 시도해주세요."
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass mt-6 rounded-[2rem] p-6">
      <div className="rounded-[1.7rem] bg-white/70 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-slate-500">웹 자료 찾기</p>
            <h2 className="section-title mt-2 text-2xl font-black text-ocean">
              Google Search로 Sources 채우기
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              버튼을 누를 때만 Gemini Google Search Grounding을 1회 실행합니다. 결과는 최대 5개만 보여주고,
              저장한 자료만 Notion Sources에 들어갑니다.
            </p>
          </div>
          <span className="w-fit rounded-full bg-cream px-3 py-2 text-xs font-bold text-slate-500">
            자동 검색 없음
          </span>
        </div>

        <div className="mt-5 flex flex-col gap-2 md:flex-row">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                searchWebSources();
              }
            }}
            className="min-w-0 flex-1 rounded-[1.2rem] border border-ocean/10 bg-white/90 px-4 py-3 outline-none transition focus:border-coral"
            placeholder="예: ADsP 데이터베이스 기출 정리"
          />
          <button
            type="button"
            disabled={searchLoading}
            onClick={searchWebSources}
            className="rounded-full bg-ocean px-5 py-3 text-sm font-bold text-white transition hover:bg-ocean/90 disabled:opacity-60"
          >
            {searchLoading ? "검색 중..." : "웹에서 자료 찾기"}
          </button>
        </div>

        {searchResults.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {searchResults.map((result) => {
              const isSaved = savedSourceUrls.includes(result.url);

              return (
                <article key={result.id} className="rounded-[1.5rem] bg-white/90 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-bold text-ocean">
                      {categoryLabel[result.category]}
                    </span>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-200"
                    >
                      원문 열기
                    </a>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-slate-900">{result.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary}</p>
                  <button
                    type="button"
                    disabled={isSaved || savingSourceUrl === result.url}
                    onClick={() => saveWebSource(result)}
                    className="mt-4 rounded-full bg-coral px-4 py-2 text-sm font-bold text-white transition hover:bg-coral/90 disabled:opacity-50"
                  >
                    {isSaved ? "저장 완료" : savingSourceUrl === result.url ? "저장 중..." : "Sources에 저장"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}

        {searchHtml ? (
          <div
            className="mt-5 overflow-hidden rounded-[1.2rem] bg-white/80 p-3"
            dangerouslySetInnerHTML={{ __html: searchHtml }}
          />
        ) : null}
      </div>

      <div className="mt-6 border-t border-ocean/10 pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-slate-500">AI 자료 퀘스트</p>
          <h2 className="section-title mt-2 text-3xl font-black text-ocean">Sources를 오늘의 퀘스트로</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Notion에 모아둔 자료를 읽고, 오늘 바로 실행할 수 있는 작은 퀘스트 후보로 바꿉니다.
            마음에 드는 후보만 대시보드에 추가하세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!connected || sourceCount === 0 || loading}
            onClick={generateQuests}
            className="rounded-full bg-ocean px-5 py-3 text-sm font-bold text-white transition hover:bg-ocean/90 disabled:opacity-50"
          >
            {loading ? "자료 읽는 중..." : "자료 기반 퀘스트 생성"}
          </button>
          {quests.length > 0 ? (
            <button
              type="button"
              disabled={saving || saved}
              onClick={saveQuests}
              className="rounded-full bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-coral/90 disabled:opacity-50"
            >
              {saved ? "추가 완료" : saving ? "추가 중..." : "대시보드에 추가"}
            </button>
          ) : null}
        </div>
      </div>

      {!connected || sourceCount === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-ocean/20 bg-white/70 p-5 text-sm leading-6 text-slate-600">
          {!connected
            ? "Notion 연결이 먼저 필요합니다."
            : "Notion Sources에 자료를 하나 이상 넣으면 여기서 퀘스트를 생성할 수 있습니다."}
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            "mt-5 rounded-[1.2rem] px-4 py-3 text-sm font-semibold",
            feedback.type === "success" && "bg-ocean text-white",
            feedback.type === "error" && "bg-red-50 text-red-700",
            feedback.type === "info" && "bg-slate-900 text-white"
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="mt-5 rounded-[1.5rem] bg-white/70 p-5">
          <p className="text-sm font-bold text-ocean">이번에 읽은 Sources</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((source) => (
              <span key={source.id} className="rounded-full bg-cream px-3 py-2 text-xs font-semibold text-slate-600">
                {source.title}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {quests.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {quests.map((quest) => (
            <article key={quest.id} className="rounded-[1.5rem] bg-white/85 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-bold text-ocean">
                  {categoryLabel[quest.category]}
                </span>
                <span className="rounded-full bg-coral/10 px-3 py-1 text-xs font-bold text-coral">
                  {quest.xp} XP
                </span>
              </div>
              <h3 className="mt-3 text-lg font-black text-slate-900">{quest.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{quest.description}</p>
            </article>
          ))}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-5">
          <Link
            href="/dashboard"
            className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-ocean transition hover:bg-cream"
          >
            대시보드에서 확인하기
          </Link>
        </div>
      ) : null}
      </div>
    </section>
  );
}
