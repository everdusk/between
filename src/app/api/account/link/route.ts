import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { countryFromHeaders, telegramNeedsVpn } from "@/lib/request-country";
import { issueBotLink, loadAccount } from "@/lib/web-account-store";
import { botLinkUrl, readSession, sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
  const accountId = secret && token ? readSession(token, secret) : null;
  const account = accountId ? await loadAccount(accountId) : null;
  if (!account) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (account.telegramUserId != null) {
    return NextResponse.json({ ok: true, linked: true, url: null });
  }
  if (account.maxUserId != null) {
    return NextResponse.json({ ok: false, error: "one_bot" }, { status: 409 });
  }
  const code = await issueBotLink(account.id);
  if (!code) return accountUnavailable();
  const country = countryFromHeaders((name) => req.headers.get(name));
  return NextResponse.json({
    ok: true,
    linked: false,
    url: botLinkUrl(code),
    vpn: telegramNeedsVpn(country),
  });
}
