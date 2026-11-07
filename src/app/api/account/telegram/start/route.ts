import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { countryFromHeaders, telegramNeedsVpn } from "@/lib/request-country";
import { beginMaxLogin } from "@/lib/web-account-store";
import { newMaxLoginToken, telegramBotLoginUrl } from "@/lib/web-account";

/** Ask Telegram to confirm this browser. The page stays here and polls. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  if (!process.env.BOT_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, error: "telegram_off" }, { status: 503 });
  }
  const token = newMaxLoginToken();
  if (!(await beginMaxLogin(token))) return accountUnavailable();
  const country = countryFromHeaders((name) => req.headers.get(name));
  return NextResponse.json({
    ok: true,
    token,
    url: telegramBotLoginUrl(token),
    vpn: telegramNeedsVpn(country),
  });
}
