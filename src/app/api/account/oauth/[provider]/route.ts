import { NextResponse } from "next/server";
import { accountReady } from "@/lib/account-http";
import {
  OAUTH_COOKIE,
  authorizeUrl,
  beginOauth,
  isOauthProvider,
  oauthClient,
  oauthRedirect,
  requestOrigin,
} from "@/lib/oauth";
import { sessionSecret } from "@/lib/web-account";

function back(req: Request, code: string) {
  const url = new URL("/journal", requestOrigin(req));
  url.searchParams.set("oauth", code);
  return NextResponse.redirect(url);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  if (!isOauthProvider(raw)) return NextResponse.json({ ok: false }, { status: 404 });
  const secret = sessionSecret();
  const client = oauthClient(raw);
  if (!accountReady() || !secret || !client) return back(req, "off");

  const { pending, cookie } = beginOauth(raw, secret);
  const destination = authorizeUrl(raw, client, pending, oauthRedirect(requestOrigin(req), raw));
  const res = NextResponse.redirect(destination);
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
  });
  return res;
}
