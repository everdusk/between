import { NextResponse } from "next/server";
import { redisConfigured } from "./redis";
import { appUrl } from "./telegram-auth";
import { SESSION_COOKIE, sessionSecret, signSession } from "./web-account";

/** The site the person is actually on, so a reset link matches that host. */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return appUrl();
}

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
