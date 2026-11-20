import { NextResponse } from "next/server";
import { localeFromTelegram, resolveBotLocale } from "@/lib/i18n";
import { claimBotIntro, loadDeviceLocale, loadUserLocale, saveDeviceLocale, releaseBotIntro, rememberUser } from "@/lib/redis";
import { welcomeCaption } from "@/lib/welcome-text";
import { ensureTrial } from "@/lib/trial-bot";
import { validateInitData } from "@/lib/telegram-auth";
import { trackBotFunnel } from "@/lib/bot-funnel";
import { sendTelegramWelcome } from "@/lib/telegram-bot";
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

  const owner = await resolveJournalId(validated.user.id);
  const seen = localeFromTelegram(validated.user.language_code);
  if (seen) await saveDeviceLocale(owner, seen);
  const greeting = resolveBotLocale(await loadUserLocale(owner), seen ?? await loadDeviceLocale(owner));
  const sent = await sendTelegramWelcome(validated.user.id, welcomeCaption(greeting));
  if (!sent) {
    await releaseBotIntro(validated.user.id);
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 502 });
  }
  await rememberUser(validated.user.id);
  await ensureTrial(owner);
  await trackBotFunnel({ userId: validated.user.id, messenger: "telegram", username: validated.user.username, choice: { step: "start" } });
  return NextResponse.json({ ok: true, sent: true });
}
