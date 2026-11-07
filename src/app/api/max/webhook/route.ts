import { NextResponse } from "next/server";
import { localeFromTelegram, resolveBotLocale, resolveGreetingLocale, type LocaleId } from "@/lib/i18n";
import { addCheckinForOwner, appendBotMessageForOwner } from "@/lib/journal-server";
import { feelingLabel, formatPremiumStatus, translate } from "@/lib/messages";
import {
  getUserTimezone,
  loadDeviceLocale,
  loadUserLocale,
  loadWeekAccess,
  redisConfigured,
  rememberDeviceLocale,
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
import { linkCodeFromStart, loginTokenFromStart, maxStorageId } from "@/lib/web-account";
import { claimMaxLink, finishMaxLogin, resolveMaxJournalId } from "@/lib/web-account-store";
import { startPayload } from "@/lib/landing";
import { isBotCommand } from "@/lib/telegram-bot";
import {
  answerMaxCallback,
  downloadMaxAudio,
  ensureMaxSubscription,
  feelingFromMaxPayload,
  isMaxPrivate,
  maxAudioName,
  maxAudioUrl,
  maxLocaleCode,
  maxOpenKeyboard,
  maxText,
  maxToken,
  maxUserId,
  maxUsername,
  maxWebhookSecretMatches,
  sendMaxMessage,
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
import { accessForUser, rubPriceFromEnv } from "@/lib/week-access";

function verifyWebhookSecret(req: Request): boolean {
  return maxWebhookSecretMatches(
    req.headers.get("x-max-bot-api-secret"),
    process.env.MAX_WEBHOOK_SECRET,
  );
}

async function localesFor(userId: number, code: string | null): Promise<{
  reply: LocaleId;
  greeting: LocaleId;
  owner: string;
}> {
  const owner = await resolveMaxJournalId(userId);
  const seen = localeFromTelegram(code);
  if (seen && redisConfigured()) await rememberDeviceLocale(owner, seen);
  const selected = redisConfigured() ? await loadUserLocale(owner) : null;
  const device = redisConfigured() ? await loadDeviceLocale(owner) : null;
  return {
    owner,
    reply: resolveBotLocale(selected, device, code),
    greeting: resolveGreetingLocale(null, device, code),
  };
}

async function say(userId: number, text: string, keyboard?: MaxKeyboard) {
  await sendMaxMessage(userId, text, keyboard);
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
  const login = /^lin:([a-z0-9]{32})$/i.exec(update.callback?.payload ?? "");
  const { reply, owner } = await localesFor(userId, maxLocaleCode(update));
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
    await addCheckinForOwner(owner, parsed.slot, parsed.feeling);
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
  keyboard: MaxKeyboard,
) {
  if (!maxToken() || !redisConfigured()) {
    await say(userId, translate(reply, "botNotReady"), keyboard);
    return;
  }
  const loaded = await loadWeekAccess(owner);
  // Numeric exemptions are Telegram ids. A MAX id can share a number, so only a username grant applies.
  const resolved = accessForUser(
    loaded,
    { id: 0, username },
    process.env.WEEK_EXEMPT_USER_IDS,
    new Date(),
  );
  if (resolved.changed) await saveWeekAccess(owner, resolved.record);
  if (resolved.view.status !== "paid") {
    await say(userId, translate(reply, "botVoicePremium"), keyboard);
    return;
  }
  if (!voiceKeyReady()) {
    await say(userId, translate(reply, "botVoiceNoKey"), keyboard);
    return;
  }
  const bytes = await downloadMaxAudio(url);
  if (!bytes) {
    await say(userId, translate(reply, "botVoiceFail"), keyboard);
    return;
  }
  const allowed = await takeBriefAttempt(owner, todayInTimeZone(await getUserTimezone(owner)), VOICE_DAILY_LIMIT, "voice");
  if (!allowed) {
    await say(userId, translate(reply, "botVoiceLimit"), keyboard);
    return;
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
    return;
  }
  const body = voiceNoteBody(heard.text, caption);
  if (!body) {
    await say(userId, translate(reply, "botVoiceEmpty"), keyboard);
    return;
  }
  try {
    await appendBotMessageForOwner(owner, body);
    await trackServerEvent({ userId, event: "note", messenger: "max" });
    await say(userId, translate(reply, "botVoiceSaved", { text: voiceReplyPreview(body) }), keyboard);
  } catch {
    await say(userId, translate(reply, "botSaveFail"), keyboard);
  }
}

async function handleStart(
  userId: number,
  payload: string,
  username: string | undefined,
  greeting: LocaleId,
  reply: LocaleId,
  keyboard: MaxKeyboard,
) {
  await trackServerEvent({ userId, event: "visit", messenger: "max" });
  const loginToken = loginTokenFromStart(payload);
  if (loginToken) {
    const account = await finishMaxLogin(loginToken, userId, username);
    await say(userId, translate(reply, account ? "botLoginOk" : "botLinkBad"), keyboard);
    return;
  }
  const linkCode = linkCodeFromStart(payload);
  if (linkCode) {
    const linked = await claimMaxLink(linkCode, userId, username);
    const key = linked === "ok" ? "botLinkOk" : linked === "taken" ? "botLinkTakenMax" : "botLinkBad";
    await say(userId, translate(reply, key), keyboard);
    return;
  }
  await say(
    userId,
    translate(greeting, "botHelpMax", { price: rubPriceFromEnv(process.env.WEEK_RUB_PRICE) }),
    keyboard,
  );
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
    if (redisConfigured()) await rememberUser(maxStorageId(userId));

    if (update.update_type === "message_callback") {
      await handleCallback(update, userId);
      return NextResponse.json({ ok: true });
    }

    const { reply, greeting, owner } = await localesFor(userId, maxLocaleCode(update));
    const keyboard = maxOpenKeyboard(reply);
    const username = maxUsername(update);
    const text = maxText(update);
    const audio = maxAudioUrl(update);

    if (update.update_type === "bot_started") {
      await handleStart(userId, update.payload ?? "", username, greeting, reply, keyboard);
      return NextResponse.json({ ok: true });
    }

    if (audio && !isBotCommand(text, "start") && !isBotCommand(text, "help")) {
      await handleVoice(userId, owner, audio, text, reply, username, keyboard);
      return NextResponse.json({ ok: true });
    }

    if (!text) return NextResponse.json({ ok: true });

    if (isBotCommand(text, "start") || isBotCommand(text, "help")) {
      await handleStart(userId, startPayload(text) ?? "", username, greeting, reply, keyboard);
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
        { id: 0, username },
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
      const redis = analyticsRedis();
      const stats = redis
        ? formatAnalyticsReport(await loadAnalyticsReport(redis))
        : "Счётчики ещё не пишутся.";
      await say(userId, stats, keyboard);
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

    try {
      await appendBotMessageForOwner(owner, text);
      await trackServerEvent({ userId, event: "note", messenger: "max" });
      await say(userId, translate(reply, "botSaved"), keyboard);
    } catch {
      await say(userId, translate(reply, "botSaveFail"), keyboard);
    }
  } catch (error) {
    console.error("max webhook", error instanceof Error ? error.message : "failed");
  }

  return NextResponse.json({ ok: true });
}
