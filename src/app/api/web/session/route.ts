import { NextResponse } from "next/server";
import { redisConfigured, takeWebLogin } from "@/lib/redis";
import {
  WEB_SESSION_SECONDS,
  currentBotToken,
  isWebLoginToken,
  signWebSession,
  verifyTelegramLogin,
  webSessionSetCookie,
  type WebSession,
} from "@/lib/web-session";

function misconfigured() {
  return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function withSession(session: WebSession, token: string) {
  const res = NextResponse.json({ ok: true, name: session.name });
  res.headers.append(
    "Set-Cookie",
    webSessionSetCookie(signWebSession(session, token), WEB_SESSION_SECONDS),
  );
  return res;
}

export async function POST(req: Request) {
  const token = currentBotToken();
  if (!token) return misconfigured();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { login?: unknown; widget?: unknown };

  if (typeof payload.login === "string") {
    if (!redisConfigured() || !isWebLoginToken(payload.login)) return unauthorized();
    const login = await takeWebLogin(payload.login);
    if (!login) return unauthorized();
    return withSession({ uid: login.userId, name: login.name }, token);
  }

  if (!payload.widget || typeof payload.widget !== "object" || Array.isArray(payload.widget)) {
    return NextResponse.json({ ok: false, error: "bad_login" }, { status: 400 });
  }
  const session = verifyTelegramLogin(payload.widget as Record<string, unknown>, token);
  if (!session) return unauthorized();
  return withSession(session, token);
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", webSessionSetCookie("", 0));
  return res;
}
