import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { ensureMaxSubscription } from "@/lib/max-bot";
import { maxBotLinkUrl, maxBotReady, readSession, sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";
import { issueBotLink, loadAccount } from "@/lib/web-account-store";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const secret = sessionSecret();
  const token = sessionTokenFromRequest(req);
  const accountId = secret && token ? readSession(token, secret) : null;
  const account = accountId ? await loadAccount(accountId) : null;
  if (!account) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (account.maxUserId != null) {
    return NextResponse.json({ ok: true, linked: true, url: null });
  }
  if (!maxBotReady()) {
    return NextResponse.json({ ok: false, error: "max_off" }, { status: 503 });
  }
  const code = await issueBotLink(account.id);
  const url = code ? maxBotLinkUrl(code) : null;
  if (!code || !url) return accountUnavailable();
  await ensureMaxSubscription();
  return NextResponse.json({ ok: true, linked: false, url });
}
