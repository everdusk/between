import { NextResponse } from "next/server";
import { resolveBotLocale, resolveGreetingLocale } from "@/lib/i18n";
import { openOnboarding } from "@/lib/onboarding-flow";
import { claimBotIntro, loadDeviceLocale, loadUserLocale, redisConfigured, releaseBotIntro, rememberUser } from "@/lib/redis";
import { welcomeCaption } from "@/lib/welcome-text";
import { ensureTrial } from "@/lib/trial-bot";
import { validateInitData } from "@/lib/telegram-auth";
import { trackBotFunnel } from "@/lib/bot-funnel";
import { onboardReplyMarkup, sendTelegramWelcome, telegramRequest } from "@/lib/telegram-bot";
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
  const selected = redisConfigured() ? await loadUserLocale(validated.user.id) : null;
  const greeting = resolveGreetingLocale(null, device, validated.user.language_code);
  const reply = resolveBotLocale(selected, device, validated.user.language_code);
  const sent = await sendTelegramWelcome(validated.user.id, welcomeCaption(greeting));
  if (!sent) {
    await releaseBotIntro(validated.user.id);
    return NextResponse.json({ ok: false, error: "not_delivered" }, { status: 502 });
  }
  const owner = await resolveJournalId(validated.user.id);
  await rememberUser(validated.user.id);
  await ensureTrial(owner);
  try {
    const quiz = await openOnboarding(owner, reply);
    if (quiz) {
      const asked = await telegramRequest("sendMessage", {
        chat_id: validated.user.id,
        text: quiz.text,
        reply_markup: onboardReplyMarkup(quiz.rows),
      });
      if (asked) {
        await trackBotFunnel({ userId: validated.user.id, messenger: "telegram", choice: { step: "start" } });
      }
    }
  } catch {
    // The welcome already went out.
  }
  return NextResponse.json({ ok: true, sent: true });
}
