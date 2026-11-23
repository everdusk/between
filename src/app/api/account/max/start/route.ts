import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withLoginChallenge } from "@/lib/account-http";
import { ensureMaxSubscription } from "@/lib/max-bot";
import { maxBotLoginUrl, maxBotReady, newMaxLoginToken } from "@/lib/web-account";
import { beginMaxLogin, MAX_LOGIN_TTL_SECONDS } from "@/lib/web-account-store";
import { rememberBotAttempt } from "@/lib/registration-analytics-server";

/** Ask MAX to confirm this browser. The person presses «Войти» in the bot. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  if (!maxBotReady()) {
    return NextResponse.json({ ok: false, error: "max_off" }, { status: 503 });
  }
  await ensureMaxSubscription();
  const token = newMaxLoginToken();
  const url = maxBotLoginUrl(token);
  if (!url || !(await beginMaxLogin(token))) return accountUnavailable();
  await rememberBotAttempt(req, "max", token, MAX_LOGIN_TTL_SECONDS);
  return withLoginChallenge(NextResponse.json({ ok: true, token, url }), token);
}
