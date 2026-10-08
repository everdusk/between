import { NextResponse } from "next/server";
import { appendBotMessageToToday } from "@/lib/journal-server";
import { redisConfigured } from "@/lib/redis";
import { appUrl } from "@/lib/telegram-auth";

type TelegramChat = { id: number; type?: string };
type TelegramUser = { id: number; first_name?: string; username?: string };
type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
};
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
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

async function telegramApi(
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const token = botToken();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Ignore send failures so Telegram does not retry forever on soft errors
  }
}

function miniAppKeyboard() {
  const url = appUrl();
  return {
    inline_keyboard: [
      [{ text: "Открыть Between", web_app: { url } }],
    ],
  };
}

const HELP_TEXT =
  "Between — дневник к сеансу.\n\n" +
  "Напишите любой текст — я допишу его в сегодняшний день.\n" +
  "Потом откройте Mini App, чтобы увидеть запись, настроение и неделю.";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "between-telegram-webhook",
    redis: redisConfigured(),
    botToken: Boolean(botToken()),
  });
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

  const message = update.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  // Only private chats
  if (message.chat.type && message.chat.type !== "private") {
    return NextResponse.json({ ok: true });
  }

  const text = (message.text ?? "").trim();
  const chatId = message.chat.id;
  const userId = message.from?.id;

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const lower = text.toLowerCase();
  if (lower === "/start" || lower.startsWith("/start ") || lower === "/help") {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: HELP_TEXT,
      reply_markup: miniAppKeyboard(),
    });
    return NextResponse.json({ ok: true });
  }

  // Ignore other slash commands
  if (text.startsWith("/")) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Неизвестная команда. Напишите обычный текст — я запишу его в дневник. /help — подсказка.",
      reply_markup: miniAppKeyboard(),
    });
    return NextResponse.json({ ok: true });
  }

  if (!botToken() || !redisConfigured()) {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text:
        "Пока не могу сохранить запись: на сервере не настроены BOT_TOKEN или Redis. " +
        "Откройте Mini App — локальные записи на устройстве работают.",
      reply_markup: miniAppKeyboard(),
    });
    return NextResponse.json({ ok: true });
  }

  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await appendBotMessageToToday(userId, text);
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Записала в сегодняшний день. Откройте Between, чтобы увидеть запись.",
      reply_markup: miniAppKeyboard(),
    });
  } catch {
    await telegramApi("sendMessage", {
      chat_id: chatId,
      text: "Не удалось сохранить запись. Попробуйте ещё раз чуть позже.",
      reply_markup: miniAppKeyboard(),
    });
  }

  return NextResponse.json({ ok: true });
}
