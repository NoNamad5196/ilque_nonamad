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
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 60 * 60 * 1000;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
      }

      if (token.sub) {
        token.userId = token.sub;
      }

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60 * 1000
      ) {
        return token;
      }

      if (token.refreshToken) {
        return refreshGoogleAccessToken(token);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.accessToken = token.accessToken;
        session.error = token.error;
      }

      return session;
    },
    async signIn({ user }) {
      await upsertUserProfile(user);
      return true;
    }
  }
};

async function refreshGoogleAccessToken(token: {
  accessToken?: string;
  accessTokenExpires?: number;
  refreshToken?: string;
  error?: "RefreshAccessTokenError";
}) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken ?? ""
      })
    });

    const refreshedToken = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!response.ok || !refreshedToken.access_token) {
      throw new Error("Google token refresh failed.");
    }

    return {
      ...token,
      accessToken: refreshedToken.access_token,
      accessTokenExpires: Date.now() + (refreshedToken.expires_in ?? 3600) * 1000,
      refreshToken: refreshedToken.refresh_token ?? token.refreshToken,
      error: undefined
    };
  } catch {
    return {
      ...token,
      error: "RefreshAccessTokenError" as const
    };
  }
}

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
