import { type NextRequest, NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { recordYandexResult } from "@/lib/registration-analytics-server";
import { confirmYandexLink, toPublicAccount } from "@/lib/web-account-store";
import { linkCookie, linkOptions, yandexConfig } from "@/lib/yandex-login";

export async function POST(req: NextRequest) {
  const config = yandexConfig();
  if (!config || !accountReady()) return accountUnavailable();
  if (req.headers.get("origin") !== config.origin) return new NextResponse(null, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.password !== "string" || !body.password || body.password.length > 200) {
    return NextResponse.json({ error: "bad_login" }, { status: 400 });
  }
  const result = await confirmYandexLink(req.cookies.get(linkCookie)?.value ?? "", body.password);
  if (typeof result === "string") {
    return NextResponse.json({ error: result }, { status: result === "limited" ? 429 : result === "expired" ? 410 : 401 });
  }
  recordYandexResult(result.state, "signed_in");
  const response = NextResponse.json({ account: toPublicAccount(result.account) }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(linkCookie, "", { ...linkOptions, maxAge: 0 });
  return withSession(response, result.account.id, result.account.sessionVersion);
}
