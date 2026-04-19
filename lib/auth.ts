import { redirect } from "next/navigation";
import { getServerSession, type NextAuthOptions, type User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { env, has } from "@/lib/env";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { type Viewer } from "@/lib/types";

const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly"
];

export const authOptions: NextAuthOptions = {
  secret: env.nextAuthSecret || "ilque-dev-secret",
  session: {
    strategy: "jwt"
  },
  providers: has.auth
    ? [
        GoogleProvider({
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
          authorization: {
            params: {
              prompt: "consent",
              access_type: "offline",
              response_type: "code",
              scope: googleScopes.join(" ")
            }
          }
        })
      ]
    : [],
  pages: {
    signIn: "/"
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }

      if (token.sub) {
        token.userId = token.sub;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.accessToken = token.accessToken;
      }

      return session;
    },
    async signIn({ user }) {
      await upsertUserProfile(user);
      return true;
    }
  }
};

async function upsertUserProfile(user: User) {
  const supabase = createServiceSupabaseClient();

  if (!supabase || !user.id) {
    return;
  }

  await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.image,
      xp: 0,
      level: 1,
      streak: 0
    },
    {
      onConflict: "id"
    }
  );
}

export async function getServerAuthSession() {
  return getServerSession(authOptions);
}

export async function getViewer(): Promise<Viewer> {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/");
  }

  return createViewer(session.user);
}

export async function getApiActor() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return null;
  }

  return {
    viewer: createViewer(session.user),
    accessToken: session.accessToken
  };
}

function createViewer(user: {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}): Viewer {
  return {
    id: user.id ?? "",
    name: user.name ?? "ILQue 사용자",
    email: user.email ?? "",
    image: user.image
  };
}
