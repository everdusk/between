import { NextResponse } from "next/server";
import { localeFromTelegram, resolveBotLocale, resolveGreetingLocale, type LocaleId } from "@/lib/i18n";
import { addCheckin, appendBotMessageToToday } from "@/lib/journal-server";
import { feelingLabel, translate } from "@/lib/messages";
import {
  getUserTimezone,
  loadDeviceLocale,
  loadUserLocale,
  loadWeekAccess,
  redisConfigured,
  rememberDeviceLocale,
  saveWeekAccess,
  takeBriefAttempt,
} from "@/lib/redis";
import { appUrl } from "@/lib/telegram-auth";
import {
  downloadTelegramFile,
  miniAppKeyboard,
  parseFeelingCallback,
  telegramRequest,
} from "@/lib/telegram-bot";
import { todayInTimeZone } from "@/lib/zoned";
import {
  VOICE_DAILY_LIMIT,
  transcribeVoice,
  voiceFileName,
  voiceKeyReady,
  voiceNoteBody,
  voiceReplyPreview,
} from "@/lib/voice";
import { WEEK_INVOICE_PAYLOAD, grantWeekPaidUntil, isWeekAccessExempt, voiceNotesOpen } from "@/lib/week-access";

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
  invoice_payload?: string;
};
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
  pre_checkout_query?: PreCheckoutQuery;
};

function botToken(): string | null {
  return process.env.BOT_TOKEN?.trim() || null;
}

function verifyWebhookSecret(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "between-telegram-webhook",
    redis: redisConfigured(),
    botToken: Boolean(botToken()),
  });
}

async function handleCallback(callback: TelegramCallback) {
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
  const ours =
    query.currency === "XTR" && query.invoice_payload === WEEK_INVOICE_PAYLOAD;
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
  if (payment.currency !== "XTR" || payment.invoice_payload !== WEEK_INVOICE_PAYLOAD) return;

  const untilSec = payment.subscription_expiration_date;
  const paidUntil = new Date(
    (typeof untilSec === "number" && untilSec > 0
      ? untilSec
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000,
  ).toISOString();

  if (redisConfigured()) {
    const current = await loadWeekAccess(userId);
    await saveWeekAccess(userId, grantWeekPaidUntil(current, paidUntil));
  }

  const { reply } = await localesFor(message.from);
  await telegramRequest("sendMessage", {
    chat_id: message.chat.id,
    text: translate(reply, "botWeekPaid"),
    reply_markup: miniAppKeyboard(appUrl(), reply),
  });
}

async function handleVoice(
  message: TelegramMessage,
  media: TelegramMedia,
  reply: LocaleId,
  keyboard: ReturnType<typeof miniAppKeyboard>,
) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const say = (text: string) =>
    telegramRequest("sendMessage", { chat_id: chatId, text, reply_markup: keyboard });

  if (!userId || !botToken() || !redisConfigured()) {
    await say(translate(reply, "botNotReady"));
    return;
  }

  const access = await loadWeekAccess(userId);
  const premium = voiceNotesOpen(access, new Date(), {
    exempt: isWeekAccessExempt(
      { id: userId, username: message.from?.username },
      process.env.WEEK_EXEMPT_USER_IDS,
    ),
  });
  if (!premium) {
    await say(translate(reply, "botVoicePremium"));
    return;
  }

  if ((media.file_size ?? 0) > 20 * 1024 * 1024) {
    await say(translate(reply, "botVoiceFail"));
    return;
  }

  if (!voiceKeyReady()) {
    await say(translate(reply, "botVoiceNoKey"));
    return;
  }

  const file = await downloadTelegramFile(media.file_id);
  if (!file.ok || file.bytes.byteLength === 0 || file.bytes.byteLength > 20 * 1024 * 1024) {
    await say(translate(reply, "botVoiceFail"));
    return;
  }

  const tz = await getUserTimezone(userId);
  const allowed = await takeBriefAttempt(userId, todayInTimeZone(tz), VOICE_DAILY_LIMIT, "voice");
  if (!allowed) {
    await say(translate(reply, "botVoiceLimit"));
    return;
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
    return;
  }

  const body = voiceNoteBody(heard.text, message.caption);
  if (!body) {
    await say(translate(reply, "botVoiceEmpty"));
    return;
  }

  try {
    await appendBotMessageToToday(userId, body);
    await say(translate(reply, "botVoiceSaved", { text: voiceReplyPreview(body) }));
  } catch {
    await say(translate(reply, "botSaveFail"));
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
    await handleVoice(message, media, reply, keyboard);
    return NextResponse.json({ ok: true });
  }

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const lower = text.toLowerCase();
  if (lower === "/start" || lower.startsWith("/start ") || lower === "/help") {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(greeting, "botHelp"),
      reply_markup: miniAppKeyboard(appUrl(), greeting),
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

  try {
    await appendBotMessageToToday(userId, text);
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botSaved"),
      reply_markup: keyboard,
    });
  } catch {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: translate(reply, "botSaveFail"),
      reply_markup: keyboard,
    });
  }

  return NextResponse.json({ ok: true });
}
