import { type NextRequest, NextResponse } from "next/server";
import { accountUnavailable, withSession } from "@/lib/account-http";
import { recordYandexResult } from "@/lib/registration-analytics-server";
import { sessionSecret } from "@/lib/web-account";
import { openYandexAccount, prepareYandexLink } from "@/lib/web-account-store";
import { linkCookie, linkOptions, loginTtl, pendingCookie, pendingOptions, readYandexPending, yandexConfig, yandexIdentity } from "@/lib/yandex-login";

export async function GET(req: NextRequest) {
  const config = yandexConfig();
  const secret = sessionSecret();
  if (!config || !secret) return accountUnavailable();
  const params = req.nextUrl.searchParams;
  const pending = readYandexPending(req.cookies.get(pendingCookie)?.value ?? "", params.get("state"), secret);
  const url = new URL("/", config.origin);
  url.searchParams.set(pending?.survey ? "start" : "login", "1");
  if (pending) url.searchParams.set("lang", pending.locale);
  function back(result?: "bad" | "taken" | "link" | "missing") {
    if (result) url.searchParams.set("yandex", result);
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    if (pending) response.cookies.set(pendingCookie, "", { ...pendingOptions, maxAge: 0 });
    return response;
  }
  if (!pending) return back("bad");
  const code = params.get("code");
  if (params.get("error") === "access_denied") {
    recordYandexResult(pending.state, "oauth_cancelled");
    return back();
  }
  if (!code || params.has("error")) {
    recordYandexResult(pending.state, "error", "provider_error");
    return back("bad");
  }
  try {
    const identity = await yandexIdentity(config, code, pending.verifier);
    const account = identity && await openYandexAccount(identity, pending.create ?? pending.survey);
    if (account === "taken" && identity) {
      const token = await prepareYandexLink(identity, pending.state, loginTtl);
      if (token) {
        const response = back("link");
        response.cookies.set(linkCookie, token, linkOptions);
        return response;
      }
    }
    if (account === "missing") {
      recordYandexResult(pending.state, "error", "account_not_found");
      return back("missing");
    }
    if (account && account !== "taken") {
      recordYandexResult(pending.state, "signed_in");
      return withSession(back(), account.id, account.sessionVersion);
    }
    recordYandexResult(pending.state, "error", account === "taken" ? "taken" : identity ? "server_error" : "provider_error");
    return back(account === "taken" ? "taken" : "bad");
  } catch {
    recordYandexResult(pending.state, "error", "server_error");
    return back("bad");
  }
}
