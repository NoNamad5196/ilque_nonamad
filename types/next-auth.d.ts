import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    error?: "RefreshAccessTokenError";
    user: DefaultSession["user"] & {
      id: string;
    };
  }

  interface User {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    refreshToken?: string;
    error?: "RefreshAccessTokenError";
    userId?: string;
  }
}
