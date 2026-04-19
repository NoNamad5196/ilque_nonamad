import type { Metadata } from "next";

import "./globals.css";

import { AuthSessionProvider } from "@/components/auth/session-provider";
import { getServerAuthSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ILQue",
  description: "Google Calendar 기반 학습 퀘스트 플래너"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerAuthSession();

  return (
    <html lang="ko">
      <body className="font-body text-ink">
        <AuthSessionProvider session={session}>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
