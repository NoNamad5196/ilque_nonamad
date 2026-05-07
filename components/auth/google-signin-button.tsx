"use client";

import { signIn } from "next-auth/react";

export function GoogleSignInButton({ authConfigured }: { authConfigured: boolean }) {
  if (!authConfigured) {
    return (
      <span className="inline-flex items-center justify-center rounded-full border border-ocean/10 bg-white/80 px-6 py-3 text-sm font-semibold text-ocean">
        로그인 준비 중
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="inline-flex items-center justify-center rounded-full bg-ocean px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-ocean/90"
    >
      Google로 시작하기
    </button>
  );
}
