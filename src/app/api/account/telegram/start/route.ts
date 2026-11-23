import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withLoginChallenge } from "@/lib/account-http";
import { countryFromHeaders, telegramNeedsVpn } from "@/lib/request-country";
import { beginMaxLogin, MAX_LOGIN_TTL_SECONDS } from "@/lib/web-account-store";
import { rememberBotAttempt } from "@/lib/registration-analytics-server";
import { newMaxLoginToken, telegramBotLoginUrl } from "@/lib/web-account";

/** Ask Telegram to confirm this browser. The page stays here and polls. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  if (!process.env.BOT_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, error: "telegram_off" }, { status: 503 });
  }
  const token = newMaxLoginToken();
  if (!(await beginMaxLogin(token))) return accountUnavailable();
  await rememberBotAttempt(req, "telegram", token, MAX_LOGIN_TTL_SECONDS);
  const country = countryFromHeaders((name) => req.headers.get(name));
  return withLoginChallenge(
    NextResponse.json({
      ok: true,
      token,
      url: telegramBotLoginUrl(token),
      vpn: telegramNeedsVpn(country),
    }),
    token,
  );
}
