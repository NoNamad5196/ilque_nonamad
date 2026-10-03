"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="v2-error-page">
      <h1>학습 공간을 불러오지 못했어요.</h1>
      <p>잠시 후 다시 시도해 주세요. 저장한 데이터는 그대로 보관됩니다.</p>
      <button className="v2-button" onClick={reset}>
        다시 시도
      </button>
      <a href="/">처음으로 돌아가기</a>
    </main>
  );
}
