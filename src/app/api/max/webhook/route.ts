import { NextResponse } from "next/server";
import { type LocaleId } from "@/lib/i18n";
import { addCheckinForOwner, appendBotMessageForOwner } from "@/lib/journal-server";
import { feelingLabel, formatPremiumStatus, translate } from "@/lib/messages";
import {
  forgetBotBlocked,
  getUserTimezone,
  loadWeekAccess,
  redisConfigured,
  rememberBotBlocked,
  rememberMessengerName,
  rememberUser,
  saveWeekAccess,
  takeBriefAttempt,
} from "@/lib/redis";
import {
  analyticsRedis,
  formatAnalyticsReport,
  isAnalyticsOwner,
  loadAnalyticsReport,
  trackServerEvent,
} from "@/lib/analytics";
import { sendDueMaxPoll } from "@/lib/due-mood";
import { loadPollDay, rememberQuietChat } from "@/lib/poll-day";
import { linkCodeFromStart, loginTokenFromStart, maxStorageId } from "@/lib/web-account";
import { claimMaxLink, finishMaxLogin, resolveMaxJournalId } from "@/lib/web-account-store";
import {
  answerOnboarding,
  finishOnboarding,
  onboardingNoteIntent,
  openOnboarding,
  remindOnboarding,
} from "@/lib/onboarding-flow";
import { botFunnelBlock, trackBotFunnel } from "@/lib/bot-funnel";
import { startPayload } from "@/lib/landing";
import { reconcileSbpPayments } from "@/lib/sbp-live";
import { isBotCommand } from "@/lib/telegram-bot";
import { welcomeCaption } from "@/lib/welcome-text";
import { applyPause, ensureTrial, sessionMenu } from "@/lib/trial-bot";
import { accessForUser, entriesOpen, maxAccessIdentity } from "@/lib/week-access";
import {
  answerMaxCallback,
  downloadMaxAudio,
  ensureMaxSubscription,
  feelingFromMaxPayload,
  isMaxPrivate,
  maxAudioName,
  maxAudioUrl,
  maxLoginKeyboard,
  maxOpenKeyboard,
  maxOnboardKeyboard,
  weekOpenKeyboard,
  maxText,
  maxToken,
  maxUserId,
  maxUsername,
  maxWebhookSecretMatches,
  sendMaxMessage,
  sendMaxWelcome,
  type MaxKeyboard,
  type MaxUpdate,
} from "@/lib/max-bot";
import { todayInTimeZone } from "@/lib/zoned";
import {
  VOICE_DAILY_LIMIT,
  transcribeVoice,
  voiceKeyReady,
  voiceNoteBody,
  voiceReplyPreview,
} from "@/lib/voice";

function verifyWebhookSecret(req: Request): boolean {
  return maxWebhookSecretMatches(
    req.headers.get("x-max-bot-api-secret"),
    process.env.MAX_WEBHOOK_SECRET,
  );
}

async function localesFor(userId: number): Promise<{
  reply: LocaleId;
  greeting: LocaleId;
  owner: string;
}> {
  return {
    owner: await resolveMaxJournalId(userId),
    reply: "ru",
    greeting: "ru",
  };
}

async function say(userId: number, text: string, keyboard?: MaxKeyboard, chatId?: number) {
  return sendMaxMessage(userId, text, keyboard, chatId);
}

export async function GET() {
  const subscription = maxToken() ? await ensureMaxSubscription() : { ok: false, reason: "no_token" };
  return NextResponse.json({
    ok: true,
    service: "between-max-webhook",
    redis: redisConfigured(),
    botToken: Boolean(maxToken()),
    username: Boolean(process.env.MAX_BOT_USERNAME?.trim()),
    subscribed: subscription.ok,
    subscription: subscription.reason,
  });
}

async function handleCallback(update: MaxUpdate, userId: number) {
  const callbackId = update.callback?.callback_id;
  if (!callbackId) return;
  const payload = update.callback?.payload ?? "";
  const { reply, owner } = await localesFor(userId);
  if (payload.startsWith("ob:")) {
    const result = await answerOnboarding(owner, reply, payload, { userId, messenger: "max" });
    if (result.type !== "update") {
      await answerMaxCallback(callbackId, null);
      return;
    }
    await answerMaxCallback(callbackId, result.text, maxOnboardKeyboard(result.rows));
    return;
  }
  if (payload === "ps:1" || payload === "ps:0" || payload === "pay:later") {
    if (payload === "pay:later") {
      await answerMaxCallback(callbackId, null);
      return;
    }
    const text = await applyPause(owner, maxAccessIdentity(userId, maxUsername(update)), payload === "ps:1", reply);
    await answerMaxCallback(callbackId, text);
    return;
  }
  const login = /^lin:([a-z0-9]{32})$/i.exec(payload);
  if (login) {
    const account = await finishMaxLogin(login[1].toLowerCase(), userId, maxUsername(update));
    await answerMaxCallback(callbackId, translate(reply, account ? "botLoginOk" : "botLinkBad"));
    return;
  }
  const parsed = feelingFromMaxPayload(update.callback?.payload);
  if (!parsed || !maxToken() || !redisConfigured()) {
    await answerMaxCallback(callbackId, translate(reply, "botCheckinNotReady"));
    return;
  }
  try {
    const access = accessForUser(
      await loadWeekAccess(owner),
      maxAccessIdentity(userId, maxUsername(update)),
      process.env.WEEK_EXEMPT_USER_IDS,
      new Date(),
    );
    if (!entriesOpen(access.view.status)) {
      await answerMaxCallback(callbackId, translate(reply, "botEntryClosed"));
      return;
    }
    await addCheckinForOwner(owner, parsed.slot, parsed.feeling);
    await trackServerEvent({ userId, event: "mood", messenger: "max" });
    await answerMaxCallback(
      callbackId,
      translate(reply, "botCheckinSaved", { feeling: feelingLabel(reply, parsed.feeling) }),
    );
  } catch {
    await answerMaxCallback(callbackId, translate(reply, "botCheckinFail"));
  }
}

async function handleVoice(
  userId: number,
  owner: string,
  url: string,
  caption: string,
  reply: LocaleId,
  username: string | undefined,
  keyboard?: MaxKeyboard,
): Promise<boolean> {
  if (!maxToken() || !redisConfigured()) {
    await say(userId, translate(reply, "botNotReady"), keyboard);
    return false;
  }
  const loaded = await loadWeekAccess(owner);
  // Numeric exemptions are Telegram ids. The MAX id is passed separately so it cannot collide.
  const resolved = accessForUser(
    loaded,
    maxAccessIdentity(userId, username),
    process.env.WEEK_EXEMPT_USER_IDS,
    new Date(),
  );
  if (resolved.changed) await saveWeekAccess(owner, resolved.record);
  if (resolved.view.status !== "trial" && resolved.view.status !== "paid") {
    await say(userId, translate(reply, resolved.view.status === "locked" ? "botEntryClosed" : "botVoicePremium"), keyboard);
    return false;
  }
  if (!voiceKeyReady()) {
    await say(userId, translate(reply, "botVoiceNoKey"), keyboard);
    return false;
  }
  const bytes = await downloadMaxAudio(url);
  if (!bytes) {
    await say(userId, translate(reply, "botVoiceFail"), keyboard);
    return false;
  }
  const allowed = await takeBriefAttempt(owner, todayInTimeZone(await getUserTimezone(owner)), VOICE_DAILY_LIMIT, "voice");
  if (!allowed) {
    await say(userId, translate(reply, "botVoiceLimit"), keyboard);
    return false;
  }
  const heard = await transcribeVoice({
    bytes,
    filename: maxAudioName(url),
    language: reply,
  });
  if (!heard.ok) {
    const key =
      heard.reason === "forbidden"
        ? "botVoiceForbidden"
        : heard.reason === "empty"
          ? "botVoiceEmpty"
          : heard.reason === "nokey"
            ? "botVoiceNoKey"
            : "botVoiceFail";
    await say(userId, translate(reply, key), keyboard);
    return false;
  }
  const body = voiceNoteBody(heard.text, caption);
  if (!body) {
    await say(userId, translate(reply, "botVoiceEmpty"), keyboard);
    return false;
  }
  try {
    await appendBotMessageForOwner(owner, body);
    await trackServerEvent({ userId, event: "note", messenger: "max" });
    await say(userId, translate(reply, "botVoiceSaved", { text: voiceReplyPreview(body) }), keyboard);
    return true;
  } catch {
    await say(userId, translate(reply, "botSaveFail"), keyboard);
    return false;
  }
}

async function greet(
  userId: number,
  greeting: LocaleId,
  reply: LocaleId,
  username: string | undefined,
  chatId?: number,
) {
  await sendMaxWelcome(userId, welcomeCaption(greeting, "max"), undefined, chatId);
  const owner = await resolveMaxJournalId(userId);
  await ensureTrial(owner);
  const quiz = await openOnboarding(owner, reply);
  if (quiz) {
    const asked = await say(userId, quiz.text, maxOnboardKeyboard(quiz.rows), chatId);
    if (asked) await trackBotFunnel({ userId, messenger: "max", choice: { step: "start" } });
    return;
  }
  await sendDueMaxPoll({ userId, username, locale: reply, chatId });
}

async function sendWeekFollow(userId: number, reply: LocaleId, chatId?: number) {
  await say(userId, translate(reply, "botFirstNote"), weekOpenKeyboard(reply) ?? undefined, chatId);
}

async function handleStart(
  userId: number,
  payload: string,
  username: string | undefined,
  greeting: LocaleId,
  reply: LocaleId,
  keyboard?: MaxKeyboard,
  chatId?: number,
) {
  await trackServerEvent({ userId, event: "visit", messenger: "max" });
  const loginToken = loginTokenFromStart(payload);
  if (loginToken) {
    await say(userId, translate(reply, "botLoginAsk"), maxLoginKeyboard(loginToken, reply), chatId);
    return;
  }
  const linkCode = linkCodeFromStart(payload);
  if (linkCode) {
    const linked = await claimMaxLink(linkCode, userId, username);
    const key = linked === "ok" ? "botLinkOk" : linked === "taken" ? "botLinkTakenMax" : "botLinkBad";
    await say(userId, translate(reply, key), keyboard, chatId);
    if (linked === "ok") await greet(userId, greeting, reply, username, chatId);
    return;
  }
  await greet(userId, greeting, reply, username, chatId);
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let update: MaxUpdate;
  try {
    update = (await req.json()) as MaxUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  try {
    if (maxToken()) await ensureMaxSubscription();
    if (!isMaxPrivate(update)) return NextResponse.json({ ok: true });
    const userId = maxUserId(update);
    if (!userId) return NextResponse.json({ ok: true });
    if (redisConfigured()) {
      await rememberUser(maxStorageId(userId));
      await rememberMessengerName(maxStorageId(userId), maxUsername(update));
    }

    if (update.update_type === "bot_stopped") {
      await rememberBotBlocked(maxStorageId(userId));
      await trackServerEvent({ userId, event: "block", messenger: "max", username: maxUsername(update) });
      return NextResponse.json({ ok: true });
    }
    await forgetBotBlocked(maxStorageId(userId));
    await rememberQuietChat(userId, maxUsername(update), "max");

    if (update.update_type === "message_callback") {
      await handleCallback(update, userId);
      return NextResponse.json({ ok: true });
    }

    const { reply, greeting, owner } = await localesFor(userId);
    const keyboard = maxOpenKeyboard(reply) ?? undefined;
    const username = maxUsername(update);
    const text = maxText(update);
    const audio = maxAudioUrl(update);

    if (update.update_type === "bot_started") {
      await handleStart(userId, update.payload ?? "", username, greeting, reply, keyboard, update.chat_id);
      return NextResponse.json({ ok: true });
    }

    if (audio && !isBotCommand(text, "start") && !isBotCommand(text, "help")) {
      const intent = await onboardingNoteIntent(owner);
      if (intent === "block") {
        const reminder = await remindOnboarding(owner, reply);
        if (reminder) await say(userId, reminder.text, maxOnboardKeyboard(reminder.rows), update.chat_id);
        return NextResponse.json({ ok: true });
      }
      const saved = await handleVoice(userId, owner, audio, text, reply, username, keyboard);
      if (saved && intent === "finish") {
        await sendWeekFollow(userId, reply, update.chat_id);
        await finishOnboarding(owner);
        await trackBotFunnel({ userId, messenger: "max", choice: { step: "note" } });
      }
      return NextResponse.json({ ok: true });
    }

    if (!text) return NextResponse.json({ ok: true });

    if (isBotCommand(text, "start") || isBotCommand(text, "help")) {
      await handleStart(userId, startPayload(text) ?? "", username, greeting, reply, keyboard, update.chat_id);
      return NextResponse.json({ ok: true });
    }

    if (isBotCommand(text, "sessions")) {
      const menu = await sessionMenu(owner, maxAccessIdentity(userId, username), reply);
      const name = process.env.MAX_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
      const app = /^[A-Za-z0-9_]{3,64}$/.test(name);
      await say(
        userId,
        menu.text,
        {
          type: "inline_keyboard",
          payload: {
            buttons: menu.rows.map((row) =>
              row.map((button) =>
                button.data === "ps:edit" && app
                  ? { type: "open_app" as const, text: button.text, web_app: name, payload: "sessions" }
                  : { type: "callback" as const, text: button.text, payload: button.data },
              ),
            ),
          },
        },
        update.chat_id,
      );
      return NextResponse.json({ ok: true });
    }

    if (isBotCommand(text, "premium")) {
      if (!maxToken() || !redisConfigured()) {
        await say(userId, translate(reply, "botNotReady"), keyboard);
        return NextResponse.json({ ok: true });
      }
      const loaded = await loadWeekAccess(owner);
      const resolved = accessForUser(
        loaded,
        maxAccessIdentity(userId, username),
        process.env.WEEK_EXEMPT_USER_IDS,
        new Date(),
      );
      if (resolved.changed) await saveWeekAccess(owner, resolved.record);
      await say(userId, formatPremiumStatus(reply, resolved.view), keyboard);
      return NextResponse.json({ ok: true });
    }

    if (isBotCommand(text, "stats")) {
      const owners = process.env.ANALYTICS_OWNERS ?? "aliatorovskaia";
      if (!isAnalyticsOwner(username, owners)) {
        await say(userId, translate(reply, "botUnknown"), keyboard);
        return NextResponse.json({ ok: true });
      }
      try {
        await reconcileSbpPayments();
      } catch {
        // The report still renders when a replay cannot reach YooKassa.
      }
      const redis = analyticsRedis();
      const stats = redis
        ? formatAnalyticsReport(await loadAnalyticsReport(redis))
        : "Счётчики ещё не пишутся.";
      const funnel = await botFunnelBlock();
      let digest = "";
      try {
        digest = `\n\n${await loadPollDay()}`;
      } catch {
        digest = "";
      }
      const text = `${funnel ? `${stats}\n\n${funnel}` : stats}${digest}`;
      await say(userId, text, keyboard);
      return NextResponse.json({ ok: true });
    }

    if (isBotCommand(text, "paysupport")) {
      await say(userId, translate(reply, "botPaySupportMax"), keyboard);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/")) {
      await say(userId, translate(reply, "botUnknown"), keyboard);
      return NextResponse.json({ ok: true });
    }

    if (!maxToken() || !redisConfigured()) {
      await say(userId, translate(reply, "botNotReady"), keyboard);
      return NextResponse.json({ ok: true });
    }

    const noteAccess = accessForUser(
      await loadWeekAccess(owner),
      maxAccessIdentity(userId, username),
      process.env.WEEK_EXEMPT_USER_IDS,
      new Date(),
    );
    if (!entriesOpen(noteAccess.view.status)) {
      await say(userId, translate(reply, "botEntryClosed"), keyboard, update.chat_id);
      return NextResponse.json({ ok: true });
    }
    const intent = await onboardingNoteIntent(owner);
    if (intent === "block") {
      const reminder = await remindOnboarding(owner, reply);
      if (reminder) await say(userId, reminder.text, maxOnboardKeyboard(reminder.rows), update.chat_id);
      return NextResponse.json({ ok: true });
    }

    try {
      await appendBotMessageForOwner(owner, text);
      await trackServerEvent({ userId, event: "note", messenger: "max" });
      if (intent === "finish") {
        await sendWeekFollow(userId, reply, update.chat_id);
        await finishOnboarding(owner);
        await trackBotFunnel({ userId, messenger: "max", choice: { step: "note" } });
      } else {
        await say(userId, translate(reply, "botSaved"), keyboard);
      }
    } catch {
      await say(userId, translate(reply, "botSaveFail"), keyboard);
    }
  } catch (error) {
    console.error("max webhook", error instanceof Error ? error.message : "failed");
  }

  return NextResponse.json({ ok: true });
}
