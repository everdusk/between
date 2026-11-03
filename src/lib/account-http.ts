import { NextResponse } from "next/server";
import { redisConfigured } from "./redis";
import { SESSION_COOKIE, sessionSecret, signSession } from "./web-account";

export function accountReady(): boolean {
  return redisConfigured() && Boolean(sessionSecret());
}

export function accountUnavailable() {
  return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function withSession(res: NextResponse, accountId: string): NextResponse {
  const secret = sessionSecret();
  if (!secret) return res;
  res.cookies.set(SESSION_COOKIE, signSession(accountId, secret), {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
