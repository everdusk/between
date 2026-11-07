import type { LocaleId } from "./i18n";
import { translate } from "./messages";
import { appUrl } from "./telegram-auth";
import { feelingKeyboard, parseFeelingCallback } from "./telegram-bot";
import type { CheckinSlot } from "./types";

const API = "https://platform-api2.max.ru";

export type MaxUser = {
  user_id?: number;
  username?: string;
  name?: string;
  first_name?: string;
  is_bot?: boolean;
};

export type MaxUpdate = {
  update_type?: string;
  user_locale?: string | null;
  payload?: string | null;
  chat_id?: number;
  user?: MaxUser;
  callback?: {
    callback_id?: string;
    payload?: string | null;
    user?: MaxUser;
  };
  message?: {
    sender?: MaxUser;
    recipient?: { chat_id?: number; chat_type?: string; user_id?: number };
    body?: {
      mid?: string;
      text?: string | null;
      attachments?: Array<{ type?: string; payload?: { url?: string } }>;
    };
  };
};

type MaxButton =
  | { type: "callback"; text: string; payload: string }
  | { type: "link"; text: string; url: string };

export type MaxKeyboard = {
  type: "inline_keyboard";
  payload: { buttons: MaxButton[][] };
};

export function maxToken(): string | null {
  return process.env.MAX_BOT_TOKEN?.trim() || null;
}

/** When a secret is configured, MAX must send it back as `X-Max-Bot-Api-Secret`. */
export function maxWebhookSecretMatches(header: string | null, expected: string | undefined): boolean {
  const secret = expected?.trim();
  if (!secret) return true;
  return header === secret;
}

function positiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Person who sent the update. The bot's own messages are not a person. */
export function maxUserId(update: MaxUpdate): number | null {
  if (update.update_type === "message_callback") return positiveId(update.callback?.user?.user_id);
  if (update.update_type === "bot_started") return positiveId(update.user?.user_id);
  if (update.message?.sender?.is_bot) return null;
  return positiveId(update.message?.sender?.user_id);
}

export function maxUsername(update: MaxUpdate): string | undefined {
  const user =
    update.update_type === "message_callback"
      ? update.callback?.user
      : update.update_type === "bot_started"
        ? update.user
        : update.message?.sender;
  const name = user?.username?.trim().replace(/^@/, "");
  return name || undefined;
}

/** Dialogs only. A group has a chat id that is not the sender. */
export function isMaxPrivate(update: MaxUpdate): boolean {
  if (update.update_type === "bot_started" || update.update_type === "message_callback") return true;
  if (update.update_type !== "message_created") return false;
  if (update.message?.sender?.is_bot) return false;
  const type = update.message?.recipient?.chat_type;
  if (type === "channel") return false;
  const sender = update.message?.sender?.user_id;
  const chat = update.message?.recipient?.chat_id;
  if ((type === "chat" || type === "group") && sender && chat && sender !== chat) return false;
  return true;
}

export function maxText(update: MaxUpdate): string {
  return update.message?.body?.text?.trim() ?? "";
}

export function maxLocaleCode(update: MaxUpdate): string | null {
  const code = update.user_locale?.trim();
  return code || null;
}

/** Incoming voice or audio, when MAX attached a download URL. */
export function maxAudioUrl(update: MaxUpdate): string | null {
  const attachments = update.message?.body?.attachments;
  if (!Array.isArray(attachments)) return null;
  for (const item of attachments) {
    const type = item?.type?.toLowerCase();
    if (type !== "audio" && type !== "voice") continue;
    const url = item.payload?.url;
    if (typeof url === "string" && url.startsWith("https://")) return url;
  }
  return null;
}

/** Same `c:m:0` payloads the Telegram poll already understands. */
export function maxFeelingKeyboard(slot: CheckinSlot, locale: LocaleId = "ru"): MaxKeyboard {
  const keyboard = feelingKeyboard(slot, locale);
  return {
    type: "inline_keyboard",
    payload: {
      buttons: keyboard.inline_keyboard.map((row) =>
        row.map((button) => ({
          type: "callback" as const,
          text: button.text,
          payload: button.callback_data,
        })),
      ),
    },
  };
}

/** Confirms a website sign-in. Start alone does not hand the journal to the browser. */
export function maxLoginKeyboard(token: string, locale: LocaleId = "ru"): MaxKeyboard {
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[{ type: "callback", text: translate(locale, "botLoginYes"), payload: `lin:${token}` }]],
    },
  };
}

export function maxOpenKeyboard(locale: LocaleId = "ru"): MaxKeyboard {
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[{ type: "link", text: translate(locale, "botOpen"), url: `${appUrl()}/journal` }]],
    },
  };
}

export function feelingFromMaxPayload(payload: string | null | undefined) {
  if (!payload) return null;
  return parseFeelingCallback(payload);
}

async function maxFetch(path: string, body?: unknown): Promise<Response | null> {
  const token = maxToken();
  if (!token) return null;
  try {
    return await fetch(`${API}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return null;
  }
}

async function accepted(res: Response | null): Promise<boolean> {
  if (!res?.ok) return false;
  const data = (await res.json().catch(() => null)) as { success?: unknown } | null;
  if (data && data.success === false) return false;
  return true;
}

let subscribedFor = "";

/** Tells MAX where to deliver events. Safe to call again: POST updates the subscription. */
export async function ensureMaxSubscription(): Promise<boolean> {
  const secret = process.env.MAX_WEBHOOK_SECRET?.trim() ?? "";
  if (secret && !/^[A-Za-z0-9_-]{5,256}$/.test(secret)) return false;
  const url = `${appUrl()}/api/max/webhook`;
  const stamp = `${url}|${secret}`;
  if (!maxToken()) return false;
  if (subscribedFor === stamp) return true;
  const ok = await accepted(
    await maxFetch("/subscriptions", {
      url,
      update_types: ["message_created", "message_callback", "bot_started"],
      ...(secret ? { secret } : {}),
    }),
  );
  if (ok) subscribedFor = stamp;
  return ok;
}

export async function sendMaxMessage(
  userId: number,
  text: string,
  keyboard?: MaxKeyboard,
): Promise<boolean> {
  const body = {
    text: text.slice(0, 4000),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
  const ok = await accepted(await maxFetch(`/messages?user_id=${userId}`, body));
  if (ok || !keyboard) return ok;
  return accepted(await maxFetch(`/messages?user_id=${userId}`, { text: body.text }));
}

/** Replaces the message that held the mood buttons. */
export async function answerMaxCallback(callbackId: string, text: string | null): Promise<boolean> {
  const body =
    text === null
      ? {}
      : { message: { text: text.slice(0, 4000), attachments: [] as MaxKeyboard[] } };
  return accepted(
    await maxFetch(`/answers?callback_id=${encodeURIComponent(callbackId)}`, body),
  );
}

export async function downloadMaxAudio(url: string): Promise<Uint8Array | null> {
  if (!url.startsWith("https://")) return null;
  const token = maxToken();
  try {
    let res = await fetch(url, { headers: token ? { Authorization: token } : {} });
    if (!res.ok && token) res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) return null;
    return bytes;
  } catch {
    return null;
  }
}

export function maxAudioName(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").pop() ?? "";
    if (/\.(ogg|oga|mp3|m4a|wav|webm|mpeg|mp4)$/i.test(name)) return name;
  } catch {
    // The caller still gets a name whisper can accept.
  }
  return "voice.ogg";
}
