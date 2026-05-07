"use client";

import { signIn, signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

export function AuthControls({
  authConfigured,
  signedIn,
  compact = false
}: {
  authConfigured: boolean;
  signedIn: boolean;
  compact?: boolean;
}) {
  if (!authConfigured) {
    return (
      <span
        className={cn(
          "rounded-full border border-ocean/10 bg-white/70 px-3 py-2 text-sm text-ocean",
          compact && "px-2 py-1 text-xs"
        )}
      >
        로그인 준비 중
      </span>
    );
  }

  if (signedIn) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className={cn(
          "rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90",
          compact && "px-3 py-1.5 text-xs"
        )}
      >
        로그아웃
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className={cn(
        "rounded-full bg-ocean px-4 py-2 text-sm font-semibold text-white transition hover:bg-ocean/90",
        compact && "px-3 py-1.5 text-xs"
      )}
    >
      Google 로그인
    </button>
  );
}
