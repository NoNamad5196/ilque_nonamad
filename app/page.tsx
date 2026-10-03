import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { has } from "@/lib/env";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { Icon } from "@/components/v2/icon";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getServerAuthSession();
  if (session?.user) redirect("/dashboard");
  return (
    <div className="v2-app v2-landing">
      <header>
        <Link className="v2-logo" href="/">
          <span className="v2-logo-mark">
            <Icon name="spark" size={27} />
          </span>
          <strong>
            ILQue<span>나의 매일을 퀘스트로</span>
          </strong>
        </Link>
        <Link className="v2-inline-link" href={"/demo" as never}>
          먼저 둘러보기 →
        </Link>
      </header>
      <main>
        <div className="v2-landing-copy">
          <span className="v2-landing-pill">
            일정은 캘린더에, 오늘의 배움은 일퀘에.
          </span>
          <h1>
            오늘,
            <br />뭘 공부해야 하지?
            <br />
            <em>작은 퀘스트로 시작해요.</em>
          </h1>
          <p>
            목표와 마감일, 오늘의 일정과 학습 자료를 모아
            <br />
            지금 할 수 있는 한 걸음을 정해드려요.
          </p>
          <GoogleSignInButton authConfigured={has.auth} />
          <p className="v2-caption">
            Google Calendar는 읽기 전용으로 연결해요.
          </p>
          {params.error && (
            <div className="v2-alert" role="alert">
              로그인을 완료하지 못했어요. Google 계정과 연결 설정을 확인한 뒤
              다시 시도해 주세요.
            </div>
          )}
          <div className="v2-landing-trust">
            <span>
              <Icon name="check" size={15} />
              목표에 맞춘 계획
            </span>
            <span>
              <Icon name="check" size={15} />
              꾸준함을 만드는 경험치
            </span>
          </div>
        </div>
        <div className="v2-landing-preview">
          <span className="v2-landing-preview-label">나의 오늘 · 미리보기</span>
          <div className="v2-landing-preview-title">
            <h2>오늘도 한 걸음 더.</h2>
            <span>✦ 레벨 3</span>
          </div>
          <div className="v2-landing-mini-hero">
            <Icon name="book" size={49} />
            <h3>
              큰 목표도
              <br />
              작게 나누면 할 수 있어요.
            </h3>
          </div>
          <div className="v2-landing-mini-quest">
            <span className="v2-complete" />
            <div>
              <span className="v2-tag sql">데이터 · SQL</span>
              <h3>JOIN 개념 정리하고 예제 3개 풀기</h3>
              <p>
                30분 예상 <span>+10 경험치</span>
              </p>
            </div>
          </div>
          <div className="v2-landing-mini-quest">
            <span className="v2-complete" />
            <div>
              <span className="v2-tag review">복습</span>
              <h3>어제 틀린 문제 다시 풀기</h3>
              <p>
                20분 예상 <span>+15 경험치</span>
              </p>
            </div>
          </div>
          <p className="v2-landing-preview-bottom">
            오늘의 작은 완료가 내일의 실력이 됩니다.
          </p>
        </div>
      </main>
      <section className="v2-landing-steps">
        {[
          {
            icon: "goal" as const,
            title: "목표를 정하고",
            body: "마감일과 학습할 범위를 알려주세요.",
          },
          {
            icon: "spark" as const,
            title: "오늘 할 일을 나누고",
            body: "가능한 시간에 맞춰 퀘스트를 준비해요.",
          },
          {
            icon: "flag" as const,
            title: "나만의 성장을 쌓아요",
            body: "완료 기록을 바탕으로 다음 계획이 달라져요.",
          },
        ].map((s, i) => (
          <article key={s.title}>
            <span>0{i + 1}</span>
            <Icon name={s.icon} size={24} />
            <h2>{s.title}</h2>
            <p>{s.body}</p>
          </article>
        ))}
      </section>
      <footer>ILQue · 작지만 꾸준한 배움을 위해</footer>
    </div>
  );
}
