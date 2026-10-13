import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const WEB_COOKIE = "between_web";
export const WEB_SESSION_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_MAX_AGE_SECONDS = 60 * 60 * 24;

export type WebSession = {
  uid: number;
  name: string;
};

function botToken(): string | null {
  const token = process.env.BOT_TOKEN?.trim();
  return token || null;
}

export function newWebLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isWebLoginToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Telegram Login Widget payload. Secret is SHA256(bot token), not the Mini App key. */
export function verifyTelegramLogin(
  input: Record<string, unknown>,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WebSession | null {
  const hash = input.hash;
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/i.test(hash)) return null;

  const fields: [string, string][] = [];
  for (const [key, value] of Object.entries(input)) {
    if (key === "hash" || value == null || value === "") continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      fields.push([key, String(Math.trunc(value))]);
    } else if (typeof value === "string") {
      fields.push([key, value]);
    } else {
      return null;
    }
  }

  fields.sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = fields.map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHash("sha256").update(token).digest();
  const calculated = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqual(calculated, hash)) return null;

  const id = Number(fields.find(([key]) => key === "id")?.[1]);
  const authDate = Number(fields.find(([key]) => key === "auth_date")?.[1]);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!Number.isFinite(authDate)) return null;
  const age = nowSeconds - authDate;
  if (age < 0 || age > LOGIN_MAX_AGE_SECONDS) return null;

  const first = fields.find(([key]) => key === "first_name")?.[1] ?? "";
  const last = fields.find(([key]) => key === "last_name")?.[1] ?? "";
  return { uid: id, name: [first, last].filter(Boolean).join(" ").slice(0, 120) };
}

export function signWebSession(
  session: WebSession,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const body = Buffer.from(
    JSON.stringify({ uid: session.uid, name: session.name, exp: nowSeconds + WEB_SESSION_SECONDS }),
  ).toString("base64url");
  const sig = createHmac("sha256", token).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readWebSession(
  value: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WebSession | null {
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", token).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;

  let parsed: { uid?: unknown; name?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      uid?: unknown;
      name?: unknown;
      exp?: unknown;
    };
  } catch {
    return null;
  }
  if (typeof parsed.uid !== "number" || !Number.isInteger(parsed.uid) || parsed.uid <= 0) {
    return null;
  }
  if (typeof parsed.exp !== "number" || parsed.exp < nowSeconds) return null;
  if (typeof parsed.name !== "string") return null;
  return { uid: parsed.uid, name: parsed.name };
}

export function webSessionFromRequest(req: Request): WebSession | null {
  const token = botToken();
  if (!token) return null;
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key !== WEB_COOKIE) continue;
    try {
      return readWebSession(decodeURIComponent(rest.join("=")), token);
    } catch {
      return null;
    }
  }
  return null;
}

export function webSessionSetCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${WEB_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function currentBotToken(): string | null {
  return botToken();
}
