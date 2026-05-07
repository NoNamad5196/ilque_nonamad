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
    <div className="min-h-screen px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="sticky top-3 z-20 mb-6 rounded-2xl border border-ocean/10 bg-white/90 px-4 py-3 shadow-sm backdrop-blur md:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="inline-flex items-center gap-3">
                <img
                  src="/ilque-icon.png"
                  alt="ILQue 아이콘"
                  className="h-10 w-10 rounded-xl object-cover shadow-sm"
                />
                <span className="text-2xl font-black text-ocean">ILQue</span>
              </Link>
              <div className="flex items-center gap-2 lg:hidden">
                <AuthControls authConfigured={has.auth} signedIn compact />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-1 lg:flex-row lg:items-center lg:justify-between">
              <nav className="flex flex-wrap gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition",
                      currentTab === item.key
                        ? "bg-ocean text-white"
                        : "bg-white text-slate-600 hover:bg-cream"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <a
                  href="https://notebooklm.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-cream"
                >
                  NotebookLM
                </a>
              </nav>

              <div className="hidden items-center gap-3 lg:flex">
                <div className="rounded-full border border-ocean/10 bg-white px-4 py-2 text-sm text-slate-600">
                  {viewer.name} 님
                </div>
                <AuthControls authConfigured={has.auth} signedIn />
              </div>
            </div>
          </div>
        </header>

        <main>
          <section className="mb-6 border-b border-ocean/10 pb-5">
            <p className="text-sm font-semibold text-coral">Daily Quest Planner</p>
            <h1 className="mt-2 text-3xl font-black text-ocean md:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{subtitle}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}
