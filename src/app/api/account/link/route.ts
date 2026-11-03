import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
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
  const code = await issueBotLink(account.id);
  if (!code) return accountUnavailable();
  return NextResponse.json({ ok: true, linked: false, url: botLinkUrl(code) });
}
