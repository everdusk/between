import { NextResponse } from "next/server";
import { addCheckin, appendBotMessageToToday } from "@/lib/journal-server";
import { redisConfigured } from "@/lib/redis";
import { appUrl } from "@/lib/telegram-auth";
import {
  miniAppKeyboard,
  parseFeelingCallback,
  telegramRequest,
} from "@/lib/telegram-bot";

type TelegramChat = { id: number; type?: string };
type TelegramUser = { id: number; first_name?: string; username?: string };
type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};
type TelegramCallback = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: { message_id: number; chat: TelegramChat };
};
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallback;
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

const HELP_TEXT =
  "Between — дневник к сеансу.\n\n" +
  "Напишите любой текст — я сохраню его отдельной заметкой на сегодня и сама поставлю темы.\n" +
  "Утром, днём и вечером могу спросить, как вы. Вечером напомню, если за день не было заметки.\n" +
  "Расписание и выключатели — в Mini App, вкладка «Сеансы».";

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

  if (!botToken() || !redisConfigured()) {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Сервер ещё не готов сохранить отметку.",
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
        text: `Записала: ${parsed.feeling}. Если хотите, допишите заметку следующим сообщением.`,
      });
    }
  } catch {
    await telegramRequest("answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Не удалось сохранить отметку. Попробуйте ещё раз.",
      show_alert: true,
    });
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

  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  if (message.chat.type && message.chat.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  const text = (message.text ?? "").trim();
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const keyboard = miniAppKeyboard(appUrl());

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const lower = text.toLowerCase();
  if (lower === "/start" || lower.startsWith("/start ") || lower === "/help") {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: HELP_TEXT,
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/")) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "Неизвестная команда. Напишите обычный текст — я запишу его отдельной заметкой. /help — подсказка.",
      reply_markup: keyboard,
    });
    return NextResponse.json({ ok: true });
  }

  if (!botToken() || !redisConfigured()) {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text:
        "Пока не могу сохранить запись: на сервере не настроены BOT_TOKEN или Redis. " +
        "Откройте Mini App — локальные записи на устройстве работают.",
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
      text: "Записала отдельной заметкой на сегодня. Откройте Between, чтобы увидеть её.",
      reply_markup: keyboard,
    });
  } catch {
    await telegramRequest("sendMessage", {
      chat_id: chatId,
      text: "Не удалось сохранить запись. Попробуйте ещё раз чуть позже.",
      reply_markup: keyboard,
    });
  }

  return NextResponse.json({ ok: true });
}
