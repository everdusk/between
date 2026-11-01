import { NextResponse } from "next/server";
import { resolveGreetingLocale } from "@/lib/i18n";
import { translate } from "@/lib/messages";
import { claimBotIntro, loadDeviceLocale, redisConfigured, releaseBotIntro } from "@/lib/redis";
import { appUrl, validateInitData } from "@/lib/telegram-auth";
import { miniAppKeyboard, telegramRequest } from "@/lib/telegram-bot";
import { starPriceFromEnv } from "@/lib/week-access";

/** One hello in the bot chat, so a direct Mini App open still creates the dialog. */
export async function POST(req: Request) {
  if (!process.env.BOT_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateInitData(initData);
  if (!validated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const claimed = await claimBotIntro(validated.user.id);
  if (!claimed) return NextResponse.json({ ok: true, sent: false });

  const device = redisConfigured() ? await loadDeviceLocale(validated.user.id) : null;
  const greeting = resolveGreetingLocale(null, device, validated.user.language_code);
  const sent = await telegramRequest("sendMessage", {
    chat_id: validated.user.id,
    text: translate(greeting, "botHelp", {
      price: starPriceFromEnv(process.env.WEEK_STAR_PRICE),
    }),
    reply_markup: miniAppKeyboard(appUrl(), greeting),
  });
  if (!sent) {
    await releaseBotIntro(validated.user.id);
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: true });
}
