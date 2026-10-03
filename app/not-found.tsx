import Link from "next/link";
export default function NotFound() {
  return (
    <main className="v2-error-page">
      <h1>길을 잠깐 벗어났네요.</h1>
      <p>찾으시는 페이지가 없어요. 오늘의 퀘스트로 돌아가 볼까요?</p>
      <Link className="v2-button" href="/dashboard">
        오늘로 돌아가기
      </Link>
    </main>
  );
}
