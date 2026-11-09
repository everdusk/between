import { NextResponse } from "next/server";
import { resolveGreetingLocale } from "@/lib/i18n";
import { translate } from "@/lib/messages";
import { claimBotIntro, loadDeviceLocale, redisConfigured, releaseBotIntro } from "@/lib/redis";
import { sessionDateMissing } from "@/lib/session-prompt";
import { appUrl, validateInitData } from "@/lib/telegram-auth";
import { miniAppKeyboard, sessionPlanKeyboard, telegramRequest } from "@/lib/telegram-bot";
import { resolveJournalId } from "@/lib/web-account-store";

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
    text: translate(greeting, "botHelp"),
    reply_markup: miniAppKeyboard(appUrl(), greeting),
  });
  if (!sent) {
    await releaseBotIntro(validated.user.id);
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 502 });
  }
  const owner = await resolveJournalId(validated.user.id);
  if (await sessionDateMissing(owner)) {
    await telegramRequest("sendMessage", {
      chat_id: validated.user.id,
      text: translate(greeting, "botSessionAsk"),
      reply_markup: sessionPlanKeyboard(appUrl(), greeting),
    });
  }
  return NextResponse.json({ ok: true, sent: true });
}
