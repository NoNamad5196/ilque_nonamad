import Link from "next/link";

import { AuthControls } from "@/components/auth/auth-controls";
import { has } from "@/lib/env";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "대시보드", key: "dashboard" },
  { href: "/sources", label: "Notion", key: "sources" },
  { href: "/goals", label: "목표", key: "goals" },
  { href: "/history", label: "기록", key: "history" },
  { href: "/profile", label: "프로필", key: "profile" }
] as const;

export function SiteShell({
  children,
  currentTab,
  viewer,
  title,
  subtitle
}: {
  children: React.ReactNode;
  currentTab: (typeof navItems)[number]["key"];
  viewer: {
    name: string;
  };
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="glass sticky top-4 z-20 mb-6 rounded-[2rem] px-4 py-4 shadow-glow md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <img
                  src="/ilque-icon.png"
                  alt="ILQue 아이콘"
                  className="h-11 w-11 rounded-2xl object-cover shadow-sm"
                />
                <span className="section-title text-2xl font-black tracking-[-0.08em] text-ocean">
                  ILQue
                </span>
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                오늘 해야 할 공부를 퀘스트로 쪼개고 완료 흐름까지 이어갑니다.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-ocean/10 bg-white/80 px-4 py-2 text-sm text-slate-600">
                {viewer.name} 님
              </div>
              <AuthControls authConfigured={has.auth} signedIn />
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  currentTab === item.key
                    ? "bg-ocean text-white"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                )}
              >
                {item.label}
              </Link>
            ))}
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white"
            >
              NotebookLM
            </a>
          </nav>
        </header>

        <main>
          <section className="mb-6 rounded-[2rem] bg-ocean px-6 py-8 text-white shadow-glow">
            <p className="text-xs uppercase tracking-[0.24em] text-white/70">Daily Quest Planner</p>
            <h1 className="section-title mt-3 text-4xl font-black tracking-[-0.07em] md:text-5xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">{subtitle}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
