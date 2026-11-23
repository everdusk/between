import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { beginYandex, loginTtl, pendingCookie, pendingOptions, yandexConfig } from "@/lib/yandex-login";
import { rememberProviderAttempt } from "@/lib/registration-analytics-server";
import { sessionSecret } from "@/lib/web-account";

export async function POST(req: Request) {
  const config = yandexConfig();
  const secret = sessionSecret();
  if (!config || !secret || !accountReady()) return accountUnavailable();
  if (req.headers.get("origin") !== config.origin) return new NextResponse(null, { status: 403 });
  const params = new URL(req.url).searchParams;
  const survey = params.get("from") === "survey";
  const create = params.has("intent") ? params.get("intent") === "create" : survey;
  const login = beginYandex(config.id, config.origin, secret, survey, "ru", create);
  await rememberProviderAttempt(req, "yandex", login.state, 2 * loginTtl);
  const response = NextResponse.json({ url: login.url }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(pendingCookie, login.cookie, { ...pendingOptions, maxAge: loginTtl });
  return response;
}
