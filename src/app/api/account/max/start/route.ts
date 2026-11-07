import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { ensureMaxSubscription } from "@/lib/max-bot";
import { maxBotLoginUrl, maxBotReady, newMaxLoginToken } from "@/lib/web-account";
import { beginMaxLogin } from "@/lib/web-account-store";

/** Ask MAX to confirm this browser. Opening the bot completes it. */
export async function POST() {
  if (!accountReady()) return accountUnavailable();
  if (!maxBotReady()) {
    return NextResponse.json({ ok: false, error: "max_off" }, { status: 503 });
  }
  await ensureMaxSubscription();
  const token = newMaxLoginToken();
  const url = maxBotLoginUrl(token);
  if (!url || !(await beginMaxLogin(token))) return accountUnavailable();
  return NextResponse.json({ ok: true, token, url });
}
