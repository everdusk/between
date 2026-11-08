import { createHash } from "node:crypto";
import { rootCertificates } from "node:tls";
import { Agent, fetch as maxHttps } from "undici";
import type { LocaleId } from "./i18n";
import { RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA } from "./max-ca";
import { translate } from "./messages";
import { appUrl } from "./telegram-auth";
import { feelingKeyboard, parseFeelingCallback } from "./telegram-bot";
import type { CheckinSlot } from "./types";

/** MAX presents a certificate the public trust store rejects. Trust only this connection. */
const maxDispatcher = new Agent({
  connect: { ca: [...rootCertificates, RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA] },
});

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
  | { type: "link"; text: string; url: string }
  | { type: "open_app"; text: string; web_app: string };

export type MaxKeyboard = {
  type: "inline_keyboard";
  payload: { buttons: MaxButton[][] };
};

export function maxToken(): string | null {
  return process.env.MAX_BOT_TOKEN?.trim() || null;
}

/** When a secret is configured, MAX must send it back as `X-Max-Bot-Api-Secret`. */
export function maxWebhookSecretMatches(header: string | null, expected: string | undefined): boolean {
  const raw = expected?.trim() ?? "";
  if (!raw) return true;
  const secret = maxWebhookSecretValue(expected);
  return header === raw || header === secret;
}

function positiveId(value: unknown): number | null {
  if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Person who sent the update. The bot's own messages are not a person. */
export function maxUserId(update: MaxUpdate): number | null {
  if (update.update_type === "message_callback") return positiveId(update.callback?.user?.user_id);
  if (update.update_type === "bot_started" || update.update_type === "bot_stopped") {
    return positiveId(update.user?.user_id);
  }
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
  if (
    update.update_type === "bot_started" ||
    update.update_type === "bot_stopped" ||
    update.update_type === "message_callback"
  ) {
    return true;
  }
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

/** Opens the MAX mini app. A link to the site becomes a plain webview, which only Telegram uses. */
export function maxOpenKeyboard(locale: LocaleId = "ru"): MaxKeyboard | null {
  const name = process.env.MAX_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{3,64}$/.test(name)) return null;
  return {
    type: "inline_keyboard",
    payload: {
      buttons: [[{ type: "open_app", text: translate(locale, "botOpen"), web_app: name }]],
    },
  };
}

export function feelingFromMaxPayload(payload: string | null | undefined) {
  if (!payload) return null;
  return parseFeelingCallback(payload);
}

type MaxResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

async function maxFetch(path: string, body?: unknown): Promise<MaxResponse | null> {
  const token = maxToken();
  if (!token) return null;
  try {
    return await maxHttps(`${API}${path}`, {
      method: body === undefined ? "GET" : "POST",
      dispatcher: maxDispatcher,
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

async function accepted(res: MaxResponse | null): Promise<boolean> {
  if (!res?.ok) return false;
  const data = (await res.json().catch(() => null)) as { success?: unknown } | null;
  if (data && data.success === false) return false;
  return true;
}

/** MAX only accepts this alphabet. A secret with other characters is hashed into it. */
export function maxWebhookSecretValue(configured: string | undefined): string {
  const raw = configured?.trim() ?? "";
  if (!raw || /^[A-Za-z0-9_-]{5,256}$/.test(raw)) return raw;
  return createHash("sha256").update(raw).digest("hex");
}

let subscribedFor = "";

export type MaxSubscription = { ok: boolean; reason: string };

/** Tells MAX where to deliver events, including the deep-link open. Safe to call again. */
export const MAX_UPDATE_TYPES = [
  "message_created",
  "message_callback",
  "bot_started",
  "bot_stopped",
] as const;

export async function ensureMaxSubscription(): Promise<MaxSubscription> {
  const secret = maxWebhookSecretValue(process.env.MAX_WEBHOOK_SECRET);
  const url = `${appUrl()}/api/max/webhook`;
  const stamp = `${url}|${secret}|${MAX_UPDATE_TYPES.join(",")}`;
  if (!maxToken()) return { ok: false, reason: "no_token" };
  if (subscribedFor === stamp) return { ok: true, reason: "ok" };
  const res = await maxFetch("/subscriptions", {
    url,
    update_types: [...MAX_UPDATE_TYPES],
    ...(secret ? { secret } : {}),
  });
  if (!res) return { ok: false, reason: "unreachable" };
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  const data = (await res.json().catch(() => null)) as { success?: unknown } | null;
  if (data && data.success === false) return { ok: false, reason: "rejected" };
  subscribedFor = stamp;
  return { ok: true, reason: "ok" };
}

export async function sendMaxMessage(
  userId: number,
  text: string,
  keyboard?: MaxKeyboard,
  chatId?: number,
): Promise<boolean> {
  const textOnly = { text: text.slice(0, 4000) };
  const withKeys = keyboard ? { ...textOnly, attachments: [keyboard] } : textOnly;
  const paths = [`/messages?user_id=${userId}`];
  if (chatId && chatId !== userId) paths.push(`/messages?chat_id=${chatId}`);
  for (const path of paths) {
    if (await accepted(await maxFetch(path, withKeys))) return true;
    if (keyboard && (await accepted(await maxFetch(path, textOnly)))) return true;
  }
  return false;
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
