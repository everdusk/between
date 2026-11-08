import { NextResponse } from "next/server";
import { redisConfigured } from "./redis";
import { appUrl } from "./telegram-auth";
import {
  LOGIN_COOKIE,
  SESSION_COOKIE,
  loginChallenge,
  loginChallengeMatches,
  cookieValue,
  sessionSecret,
  signSession,
} from "./web-account";

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

export function withSession(res: NextResponse, accountId: string, sessionVersion = 0): NextResponse {
  const secret = sessionSecret();
  if (!secret) return res;
  res.cookies.set(SESSION_COOKIE, signSession(accountId, secret, Date.now(), sessionVersion), {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

/** Only the browser that started messenger login may collect the session. */
export function withLoginChallenge(res: NextResponse, token: string): NextResponse {
  const secret = sessionSecret();
  if (!secret) return res;
  res.cookies.set(LOGIN_COOKIE, loginChallenge(token, secret), {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
  });
  return res;
}

export function loginChallengeOk(req: Request, token: string): boolean {
  const secret = sessionSecret();
  if (!secret) return false;
  return loginChallengeMatches(cookieValue(req.headers.get("cookie"), LOGIN_COOKIE), token, secret);
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    ...cookieBase,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
