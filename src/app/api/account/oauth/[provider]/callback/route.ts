import { NextResponse } from "next/server";
import { accountReady, withSession } from "@/lib/account-http";
import { exchangeOauth } from "@/lib/oauth-exchange";
import {
  OAUTH_COOKIE,
  isOauthProvider,
  oauthClient,
  oauthRedirect,
  readOauth,
  requestOrigin,
} from "@/lib/oauth";
import { sessionSecret } from "@/lib/web-account";
import { upsertOauthAccount } from "@/lib/web-account-store";

function back(req: Request, code: string | null, cookie = "") {
  const url = new URL("/journal", requestOrigin(req));
  if (code) url.searchParams.set("oauth", code);
  const res = NextResponse.redirect(url);
  if (cookie) {
    res.cookies.set(OAUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }
  return res;
}

function cookieValue(req: Request): string {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    if (!part.startsWith(`${OAUTH_COOKIE}=`)) continue;
    const value = part.slice(OAUTH_COOKIE.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  if (!isOauthProvider(raw)) return NextResponse.json({ ok: false }, { status: 404 });
  const secret = sessionSecret();
  const client = oauthClient(raw);
  const pending = secret ? readOauth(cookieValue(req), secret) : null;
  if (!accountReady() || !secret || !client || !pending || pending.provider !== raw) {
    return back(req, "bad", cookieValue(req));
  }

  const url = new URL(req.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (url.searchParams.get("error") || state !== pending.state || !code) {
    return back(req, "bad", cookieValue(req));
  }

  let identity: Awaited<ReturnType<typeof exchangeOauth>>;
  try {
    identity = await exchangeOauth(
      raw,
      client,
      code,
      pending,
      url.searchParams.get("device_id") ?? "",
      oauthRedirect(requestOrigin(req), raw),
    );
  } catch {
    return back(req, "bad", cookieValue(req));
  }
  if (!identity) return back(req, "bad", cookieValue(req));

  const account = await upsertOauthAccount({
    provider: raw,
    providerUserId: identity.id,
    altIds: identity.altIds,
    email: identity.email,
  });
  if (account === "taken") return back(req, "taken", cookieValue(req));
  if (!account) return back(req, "off", cookieValue(req));

  const res = withSession(back(req, null, cookieValue(req)), account.id);
  return res;
}
