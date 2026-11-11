import type { LocaleId } from "./i18n";
import { sessionTabUrl, weekTabUrl } from "./launch-section";
import { feelingLabel, translate } from "./messages";
import { PICKER_FEELINGS, type CheckinSlot } from "./types";
import { loadWelcomeImage } from "./welcome-photo";

const SLOT_CODE: Record<CheckinSlot, string> = {
  morning: "m",
  day: "d",
  evening: "e",
};

const CODE_SLOT: Record<string, CheckinSlot> = {
  m: "morning",
  d: "day",
  e: "evening",
};

export function feelingKeyboard(slot: CheckinSlot, locale: LocaleId = "ru") {
  const code = SLOT_CODE[slot];
  const rows = [];
  for (let index = 0; index < PICKER_FEELINGS.length; index += 3) {
    rows.push(
      PICKER_FEELINGS.slice(index, index + 3).map((feeling, offset) => ({
        text: feelingLabel(locale, feeling),
        callback_data: `c:${code}:${index + offset}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

export function parseFeelingCallback(
  data: string,
): { slot: CheckinSlot; feeling: (typeof PICKER_FEELINGS)[number] } | null {
  const match = /^c:([mde]):(\d)$/.exec(data);
  if (!match) return null;
  const slot = CODE_SLOT[match[1]];
  const feeling = PICKER_FEELINGS[Number(match[2])];
  if (!slot || !feeling) return null;
  return { slot, feeling };
}

export function miniAppKeyboard(url: string, locale: LocaleId = "ru") {
  return {
    inline_keyboard: [[{ text: translate(locale, "botOpen"), web_app: { url } }]],
  };
}

/** Opens the journal on the session date. */
export function sessionPlanKeyboard(url: string, locale: LocaleId = "ru") {
  return {
    inline_keyboard: [[
      { text: translate(locale, "botSessionOpen"), web_app: { url: sessionTabUrl(url) } },
    ]],
  };
}

/** Opens the journal on the week, after the first note. */
export function weekOpenKeyboard(url: string, locale: LocaleId = "ru") {
  return {
    inline_keyboard: [[
      { text: translate(locale, "botWeekOpen"), web_app: { url: weekTabUrl(url) } },
    ]],
  };
}

export function onboardReplyMarkup(rows: { text: string; data: string }[][]) {
  return {
    inline_keyboard: rows.map((row) =>
      row.map((button) => ({ text: button.text, callback_data: button.data })),
    ),
  };
}

/** `/paysupport`, `/paysupport@Bot`, and `/paysupport something`. */
export function isBotCommand(text: string, name: string): boolean {
  const lower = text.trim().toLowerCase();
  const command = `/${name.toLowerCase()}`;
  return lower === command || lower.startsWith(`${command} `) || lower.startsWith(`${command}@`);
}

const COMMANDS_EN = [
  { command: "start", description: "Open Between" },
  { command: "premium", description: "Premium time left" },
  { command: "paysupport", description: "Stars payment help" },
];

const COMMANDS_RU = [
  { command: "start", description: "Открыть Between" },
  { command: "premium", description: "Сколько премиума осталось" },
  { command: "paysupport", description: "Вопрос по оплате" },
];

let commandsReady = false;
let blocksReady = false;

/** Person who blocked the bot in a private chat. A group kick is not this. */
export function blockedTelegramUser(update: {
  chat?: { id?: number; type?: string };
  from?: { id?: number };
  old_chat_member?: { status?: string };
  new_chat_member?: { status?: string };
}): number | null {
  if (update.chat?.type !== "private") return null;
  if (update.new_chat_member?.status !== "kicked") return null;
  if (update.old_chat_member?.status === "kicked") return null;
  const userId = update.from?.id ?? update.chat.id;
  return typeof userId === "number" && userId > 0 ? userId : null;
}

/**
 * The production webhook lists update types and leaves blocks out.
 * Add `my_chat_member` without dropping the secret already configured.
 */
export async function ensureTelegramBlocks(): Promise<void> {
  if (blocksReady || !process.env.BOT_TOKEN?.trim()) return;
  const info = await telegramCall<{ url?: string; allowed_updates?: string[] }>("getWebhookInfo", {});
  if (!info.ok || !info.result) return;
  const url = info.result.url?.trim() ?? "";
  const allowed = info.result.allowed_updates ?? [];
  if (!url || allowed.length === 0 || allowed.includes("my_chat_member")) {
    blocksReady = true;
    return;
  }
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const set = await telegramCall("setWebhook", {
    url,
    allowed_updates: [...new Set([...allowed, "my_chat_member"])],
    ...(secret ? { secret_token: secret } : {}),
  });
  if (set.ok) blocksReady = true;
}

/** Menu list Telegram checks when a bot takes Stars. Safe to call on every update. */
export async function publishBotCommands(): Promise<void> {
  if (commandsReady || !process.env.BOT_TOKEN?.trim()) return;
  const english = await telegramRequest("setMyCommands", { commands: COMMANDS_EN });
  const russian = await telegramRequest("setMyCommands", {
    commands: COMMANDS_RU,
    language_code: "ru",
  });
  if (english && russian) commandsReady = true;
}

export async function telegramCall<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; description: string }> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) return { ok: false, description: "no_token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok) return { ok: false, description: data.description || "telegram_error" };
    return { ok: true, result: data.result as T };
  } catch {
    return { ok: false, description: "network" };
  }
}

export async function telegramRequest(
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const result = await telegramCall<unknown>(method, body);
  return result.ok;
}

/** Welcome with the flow picture. The caption keeps the session button. Text follows if the picture cannot go out. */
export async function sendTelegramWelcome(
  chatId: number,
  caption: string,
  replyMarkup: unknown,
): Promise<boolean> {
  const text = caption.slice(0, 1024);
  const bytes = await loadWelcomeImage();
  const token = process.env.BOT_TOKEN?.trim();
  if (bytes && token) {
    const form = new FormData();
    form.set("chat_id", String(chatId));
    form.set("caption", text);
    form.set("reply_markup", JSON.stringify(replyMarkup));
    form.set("photo", new File([Buffer.from(bytes)], "welcome.png", { type: "image/png" }));
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean };
      if (data.ok) return true;
    } catch {
      // The text welcome still goes out.
    }
  }
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
}

/** Downloads a voice or audio file. The bot token stays in the request URL and is not logged. */
export async function downloadTelegramFile(
  fileId: string,
): Promise<{ ok: true; bytes: Uint8Array; path: string } | { ok: false }> {
  const meta = await telegramCall<{ file_path?: string; file_size?: number }>("getFile", {
    file_id: fileId,
  });
  if (!meta.ok || !meta.result.file_path) return { ok: false };
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${meta.result.file_path}`);
    if (!res.ok) return { ok: false };
    return {
      ok: true,
      bytes: new Uint8Array(await res.arrayBuffer()),
      path: meta.result.file_path,
    };
  } catch {
    return { ok: false };
  }
}
