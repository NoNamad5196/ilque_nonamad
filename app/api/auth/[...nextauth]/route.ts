import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";
import { has } from "@/lib/env";
import { errorResponse } from "@/lib/api-response";

const disabledHandler = () => errorResponse("Google 로그인 설정이 아직 완료되지 않았습니다.", 503);

const handler = has.auth ? NextAuth(authOptions) : disabledHandler;

export { handler as GET, handler as POST };
