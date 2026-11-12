import { NextResponse } from "next/server";
import { localeFromTelegram, resolveBotLocale, resolveGreetingLocale, type LocaleId } from "@/lib/i18n";
import { addCheckin, appendBotMessageToToday } from "@/lib/journal-server";
import { countPhrase, feelingLabel, formatPremiumStatus, translate } from "@/lib/messages";
import {
  getRedis,
  getUserTimezone,
  loadDeviceLocale,
  loadUserLocale,
  claimPaymentCharge,
  loadWeekAccess,
  redisConfigured,
  releasePaymentCharge,
  rememberDeviceLocale,
  saveWeekAccess,
  takeBriefAttempt,
} from "@/lib/redis";
import {
  analyticsRedis,
  formatAnalyticsReport,
  isAnalyticsOwner,
  loadAnalyticsReport,
  recordPaidAnalytics,
  trackServerEvent,
} from "@/lib/analytics";
import { linkCodeFromStart, loginTokenFromStart } from "@/lib/web-account";
import { claimTelegramLink, finishTelegramLogin, resolveJournalId } from "@/lib/web-account-store";
import {
  answerOnboarding,
  finishOnboarding,
  onboardingNoteIntent,
  openOnboarding,
  remindOnboarding,
} from "@/lib/onboarding-flow";
import {
  isLandingStart,
  rememberLandingSource,
  startPayload,
} from "@/lib/landing";
import { botFunnelBlock, trackBotFunnel } from "@/lib/bot-funnel";
import { reconcileSbpPayments } from "@/lib/sbp-live";
import { appUrl } from "@/lib/telegram-auth";
import {
  downloadTelegramFile,
  isBotCommand,
  miniAppKeyboard,
  onboardReplyMarkup,
  sendTelegramWelcome,
  weekOpenKeyboard,
  parseFeelingCallback,
  blockedTelegramUser,
  ensureTelegramBlocks,
  publishBotCommands,
  telegramRequest,
} from "@/lib/telegram-bot";
import { todayInTimeZone } from "@/lib/zoned";
import { welcomeCaption } from "@/lib/welcome-text";
import {
  VOICE_DAILY_LIMIT,
  transcribeVoice,
  voiceFileName,
  voiceKeyReady,
  voiceNoteBody,
  voiceReplyPreview,
} from "@/lib/voice";
import {
  accessForUser,
  grantWeekPaidUntil,
  paidUntilForPlan,
  planDays,
  planFromPayload,
  starPriceFromEnv,
  starsChargeAccepted,
} from "@/lib/week-access";

type TelegramChat = { id: number; type?: string };
type TelegramUser = {
  id: number;
  first_name?: string;
  username?: string;
  language_code?: string;
};
type SuccessfulPayment = {
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
  telegram_payment_charge_id?: string;
  subscription_expiration_date?: number;
};
type TelegramMedia = {
  file_id: string;
  mime_type?: string;
  file_size?: number;
};
type TelegramMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  voice?: TelegramMedia;
  audio?: TelegramMedia;
  chat: TelegramChat;
  from?: TelegramUser;
  successful_payment?: SuccessfulPayment;
};
type TelegramCallback = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: { message_id: number; chat: TelegramChat };
};
type PreCheckoutQuery = {
  id: string;
  from: TelegramUser;
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
};
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
  pre_checkout_query?: PreCheckoutQuery;
  my_chat_member?: {
    chat?: { id?: number; type?: string };
    from?: { id?: number };
    old_chat_member?: { status?: string };
    new_chat_member?: { status?: string };
  };
};

function botToken(): string | null {
  return process.env.BOT_TOKEN?.trim() || null;
}

function verifyWebhookSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const got = req.headers.get("x-telegram-bot-api-secret-token");
  return got === expected;
}

async function localesFor(user: TelegramUser | undefined): Promise<{
  reply: LocaleId;
  greeting: LocaleId;
}> {
  const code = user?.language_code;
  const seen = localeFromTelegram(code);
  if (user?.id && seen && redisConfigured()) {
    await rememberDeviceLocale(user.id, seen);
  }
  const selected = user?.id && redisConfigured() ? await loadUserLocale(user.id) : null;
  const device = user?.id && redisConfigured() ? await loadDeviceLocale(user.id) : null;
  return {
    reply: resolveBotLocale(selected, device, code),
    greeting: resolveGreetingLocale(null, device, code),
  };
}

async function sendQuiz(chatId: number, userId: number, locale: LocaleId, username?: string) {
  if (!redisConfigured()) return;
  try {
    const quiz = await openOnboarding(await resolveJournalId(userId), locale);
    if (!quiz) return;
    const sent = await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: quiz.text,
      reply_markup: onboardReplyMarkup(quiz.rows),
    });
    if (sent) {
      await trackBotFunnel({ userId, messenger: "telegram", username, choice: { step: "start" } });
    }
  } catch {
    // The welcome already went out.
  }
}

async function sendWeekFollow(chatId: number, locale: LocaleId) {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: translate(locale, "botFirstNote"),
    reply_markup: weekOpenKeyboard(appUrl(), locale),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "between-telegram-webhook",
    redis: redisConfigured(),
    botToken: Boolean(botToken()),
  });
}

async function handleCallback(callback: TelegramCallback) {
  if (callback.data?.startsWith("ob:") && callback.from?.id) {
    const { reply } = await localesFor(callback.from);
    const owner = await resolveJournalId(callback.from.id);
    const result = await answerOnboarding(owner, reply, callback.data, {
      userId: callback.from.id,
      messenger: "telegram",
      username: callback.from.username,
    });
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id });
    if (result.type !== "update" || !callback.message) return;
    const markup = onboardReplyMarkup(result.rows);
    if (result.markupOnly) {
      await telegramRequest("editMessageReplyMarkup", {
        chat_id: callback.message.chat.id,
        message_id: callback.message.message_id,
        reply_markup: markup,
      });
      return;
    }
    await telegramRequest("editMessageText", {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: result.text,
      reply_markup: markup,
    });
    return;
  }
  const login = /^lin:([a-z0-9]{32})$/i.exec(callback.data ?? "");
  if (login && callback.from?.id) {
    const { reply } = await localesFor(callback.from);
    const account = await finishTelegramLogin(login[1].toLowerCase(), callback.from.id, callback.from.username);
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: translate(reply, account ? "botLoginOk" : "botLinkBad"),
    });
    return;
  }
  const parsed = callback.data ? parseFeelingCallback(callback.data) : null;
  if (!parsed || !callback.from?.id) {
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id });
    return;
  }
  const { reply } = await localesFor(callback.from);

  if (!botToken() || !redisConfigured()) {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: translate(reply, "botCheckinNotReady"),
      show_alert: true,
    });
    return;
  }

  try {
    await addCheckin(callback.from.id, parsed.slot, parsed.feeling);
    await trackServerEvent({
      userId: callback.from.id,
      event: "mood",
      messenger: "telegram",
      username: callback.from.username,
    });
    await telegramRequest("answerCallbackQuery", { callback_query_id: callback.id });
    if (callback.message) {
      await telegramRequest("editMessageText", {
        chat_id: callback.message.chat.id,
        message_id: callback.message.message_id,
        text: translate(reply, "botCheckinSaved", {
          feeling: feelingLabel(reply, parsed.feeling),
        }),
      });
    }
  } catch {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: translate(reply, "botCheckinFail"),
      show_alert: true,
    });
  }
}

async function handlePreCheckout(query: PreCheckoutQuery) {
  const plan = planFromPayload(query.invoice_payload);
  const ours = Boolean(
    plan &&
      starsChargeAccepted(plan, query.currency, query.total_amount, starPriceFromEnv(process.env.WEEK_STAR_PRICE)),
  );
  const { reply } = await localesFor(query.from);
  await telegramRequest("answerPreCheckoutQuery", {
    pre_checkout_query_id: query.id,
    ok: ours,
    ...(ours ? {} : { error_message: translate(reply, "botInvoiceForeign") }),
  });
}

async function handlePayment(message: TelegramMessage) {
  const payment = message.successful_payment;
  const userId = message.from?.id;
  if (!payment || !userId) return;
  const plan = planFromPayload(payment.invoice_payload);
  const monthly = starPriceFromEnv(process.env.WEEK_STAR_PRICE);
  if (!plan || !starsChargeAccepted(plan, payment.currency, payment.total_amount, monthly)) return;
  const chargeId = payment.telegram_payment_charge_id?.trim() ?? "";
  if (!chargeId) return;
  const claimed = await claimPaymentCharge(chargeId);
  if (claimed) {
    const paidUntil = paidUntilForPlan(plan, new Date(), payment.subscription_expiration_date);
    try {
      const owner = await resolveJournalId(userId);
      const current = await loadWeekAccess(owner);
      await saveWeekAccess(owner, grantWeekPaidUntil(current, paidUntil));
    } catch (error) {
      await releasePaymentCharge(chargeId);
      throw error;
    }
  }
  await recordPaidAnalytics(userId, chargeId, new Date(), message.from?.username);
  if (!claimed) return;

  const { reply } = await localesFor(message.from);
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: translate(reply, "botWeekPaid", { days: countPhrase(reply, planDays(plan), "day") }),
    reply_markup: miniAppKeyboard(appUrl(), reply),
  });
}

async function handleVoice(
  message: TelegramMessage,
  media: TelegramMedia,
  reply: LocaleId,
  keyboard: ReturnType<typeof miniAppKeyboard>,
): Promise<boolean> {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const say = (text: string) =>
    telegramRequest("sendMessage", { chat_id: chatId, text, reply_markup: keyboard });

  if (!userId || !botToken() || !redisConfigured()) {
    await say(translate(reply, "botNotReady"));
    return false;
  }

  const owner = await resolveJournalId(userId);
  const loaded = await loadWeekAccess(owner);
  const resolved = accessForUser(
    loaded,
    { id: userId, username: message.from?.username },
    process.env.WEEK_EXEMPT_USER_IDS,
    new Date(),
  );
  if (resolved.changed) await saveWeekAccess(owner, resolved.record);
  const premium = resolved.view.status === "paid";
  if (!premium) {
    await say(translate(reply, "botVoicePremium"));
    return false;
  }

  if ((media.file_size ?? 0) > 20 * 1024 * 1024) {
    await say(translate(reply, "botVoiceFail"));
    return false;
  }

  if (!voiceKeyReady()) {
    await say(translate(reply, "botVoiceNoKey"));
    return false;
  }

  const file = await downloadTelegramFile(media.file_id);
  if (!file.ok || file.bytes.byteLength === 0 || file.bytes.byteLength > 20 * 1024 * 1024) {
    await say(translate(reply, "botVoiceFail"));
    return false;
  }

  const tz = await getUserTimezone(userId);
  const allowed = await takeBriefAttempt(userId, todayInTimeZone(tz), VOICE_DAILY_LIMIT, "voice");
  if (!allowed) {
    await say(translate(reply, "botVoiceLimit"));
    return false;
  }

  const heard = await transcribeVoice({
    bytes: file.bytes,
    filename: voiceFileName(file.path, media.mime_type),
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
    await say(translate(reply, key));
    return false;
  }

  const body = voiceNoteBody(heard.text, message.caption);
  if (!body) {
    await say(translate(reply, "botVoiceEmpty"));
    return false;
  }

  try {
    await appendBotMessageToToday(userId, body);
    await trackServerEvent({
      userId,
      event: "note",
      messenger: "telegram",
      username: message.from?.username,
    });
    await say(translate(reply, "botVoiceSaved", { text: voiceReplyPreview(body) }));
    return true;
  } catch {
    await say(translate(reply, "botSaveFail"));
    return false;
  }
}

export async function POST(req: Request) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  await publishBotCommands();
  await ensureTelegramBlocks();

  if (update.my_chat_member) {
    const userId = blockedTelegramUser(update.my_chat_member);
    if (userId) await trackServerEvent({ userId, event: "block", messenger: "telegram" });
    return NextResponse.json({ ok: true });
  }

  if (update.pre_checkout_query) {
    await handlePreCheckout(update.pre_checkout_query);
    return NextResponse.json({ ok: true });
  }

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  if (message.successful_payment) {
    await handlePayment(message);
    return NextResponse.json({ ok: true });
  }

  if (message.chat.type && message.chat.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  const text = (message.text ?? "").trim();
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const { reply, greeting } = await localesFor(message.from);
  const keyboard = miniAppKeyboard(appUrl(), reply);
  const media = message.voice ?? message.audio;

  if (media) {
    const owner = userId && redisConfigured() ? await resolveJournalId(userId) : null;
    const intent = owner ? await onboardingNoteIntent(owner) : "free";
    if (intent === "block" && owner) {
      const reminder = await remindOnboarding(owner, reply);
      if (reminder) {
        await telegramRequest("sendMessage", {
          chat_id: chatId,
          text: reminder.text,
          reply_markup: onboardReplyMarkup(reminder.rows),
        });
      }
      return NextResponse.json({ ok: true });
    }
    const saved = await handleVoice(message, media, reply, keyboard);
    if (saved && intent === "finish" && owner && userId) {
      await sendWeekFollow(chatId, reply);
      await finishOnboarding(owner);
      await trackBotFunnel({
        userId,
        messenger: "telegram",
        username: message.from?.username,
        choice: { step: "note" },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  if (isBotCommand(text, "start") || isBotCommand(text, "help")) {
    const loginToken = loginTokenFromStart(startPayload(text) ?? "");
    if (loginToken && userId) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: translate(reply, "botLoginAsk"),
        reply_markup: {
          inline_keyboard: [[{ text: translate(reply, "botLoginYes"), callback_data: `lin:${loginToken}` }]],
        },
      });
      return NextResponse.json({ ok: true });
    }
    const linkCode = linkCodeFromStart(startPayload(text) ?? "");
    if (linkCode && userId) {
      const linked = await claimTelegramLink(linkCode, userId, message.from?.username);
      const key = linked === "ok" ? "botLinkOk" : linked === "taken" ? "botLinkTaken" : "botLinkBad";
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: translate(reply, key),
        reply_markup: keyboard,
      });
      await trackServerEvent({
        userId,
        event: "visit",
        messenger: "telegram",
        username: message.from?.username,
      });
      return NextResponse.json({ ok: true });
    }
    if (userId && isLandingStart(text)) {
      const redis = getRedis();
      if (redis) {
        try {
          await rememberLandingSource(redis, userId);
        } catch {
          // The greeting still goes out if the mark cannot be stored.
        }
      }
    }
    await sendTelegramWelcome(chatId, welcomeCaption(greeting));
    if (userId) {
      await trackServerEvent({
        userId,
        event: "visit",
        messenger: "telegram",
        username: message.from?.username,
      });
      await sendQuiz(chatId, userId, reply, message.from?.username);
    }
    return NextResponse.json({ ok: true });
  }

  if (isBotCommand(text, "premium")) {
    if (!userId || !botToken() || !redisConfigured()) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: translate(reply, "botNotReady"),
        reply_markup: keyboard,
      });
      return NextResponse.json({ ok: true });
    }
    const owner = await resolveJournalId(userId);
    const loaded = await loadWeekAccess(owner);
    const resolved = accessForUser(
      loaded,
      { id: userId, username: message.from?.username },
      process.env.WEEK_EXEMPT_USER_IDS,
      new Date(),
      starPriceFromEnv(process.env.WEEK_STAR_PRICE),
    );
    if (resolved.changed) await saveWeekAccess(owner, resolved.record);
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: formatPremiumStatus(reply, resolved.view),
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (isBotCommand(text, "stats")) {
    const owners = process.env.ANALYTICS_OWNERS ?? "aliatorovskaia";
    if (!isAnalyticsOwner(message.from?.username, owners)) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: translate(reply, "botUnknown"),
        reply_markup: keyboard,
      });
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
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: funnel ? `${stats}\n\n${funnel}` : stats,
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (isBotCommand(text, "paysupport")) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botPaySupport"),
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/")) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botUnknown"),
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (!botToken() || !redisConfigured()) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botNotReady"),
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  const owner = await resolveJournalId(userId);
  const intent = await onboardingNoteIntent(owner);
  if (intent === "block") {
    const reminder = await remindOnboarding(owner, reply);
    if (reminder) {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: reminder.text,
        reply_markup: onboardReplyMarkup(reminder.rows),
      });
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await appendBotMessageToToday(userId, text);
    await trackServerEvent({
      userId,
      event: "note",
      messenger: "telegram",
      username: message.from?.username,
    });
    if (intent === "finish") {
      await sendWeekFollow(chatId, reply);
      await finishOnboarding(owner);
      await trackBotFunnel({
        userId,
        messenger: "telegram",
        username: message.from?.username,
        choice: { step: "note" },
      });
    } else {
      await telegramRequest("sendMessage", {
        chat_id: chatId,
        text: translate(reply, "botSaved"),
        reply_markup: keyboard,
      });
    }
  } catch {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botSaveFail"),
      reply_markup: keyboard,
    });
  }

  return NextResponse.json({ ok: true });
}
