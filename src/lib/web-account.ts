import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "between_session";
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
export const LINK_TTL_SECONDS = 15 * 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function sessionSecret(): string | null {
  const secret = process.env.APP_SECRET?.trim() || process.env.BOT_TOKEN?.trim();
  return secret || null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function passwordProblem(value: unknown): "short" | "long" | null {
  if (typeof value !== "string") return "short";
  if (value.length < 8) return "short";
  if (value.length > 200) return "long";
  return null;
}

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16).toString("hex");
  const hash = await passwordHash(password, salt);
  return { salt, hash };
}

export async function passwordMatches(
  password: string,
  salt: string,
  expected: string,
): Promise<boolean> {
  const actual = await passwordHash(password, salt);
  const left = Buffer.from(actual, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

async function passwordHash(password: string, salt: string): Promise<string> {
  const derived = (await scryptAsync(password, salt, 32)) as Buffer;
  return derived.toString("hex");
}

export function newAccountId(): string {
  return `w${randomBytes(16).toString("hex")}`;
}

export function newLinkCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

/** Storage key for a Telegram user, or the shared web journal after a link. */
export function journalStorageId(telegramUserId: number, accountId: string | null): string {
  return accountId ? `web:${accountId}` : String(telegramUserId);
}

export function webStorageId(accountId: string): string {
  return `web:${accountId}`;
}

export function signSession(accountId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(`${accountId}.${now + SESSION_MS}`).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSession(token: string, secret: string, now = Date.now()): string | null {
  const split = token.split(".");
  if (split.length !== 2) return null;
  const [payload, sig] = split;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const dot = decoded.lastIndexOf(".");
  if (dot <= 0) return null;
  const accountId = decoded.slice(0, dot);
  const exp = Number(decoded.slice(dot + 1));
  if (!accountId.startsWith("w") || !Number.isFinite(exp) || exp < now) return null;
  return accountId;
}

export function sessionTokenFromRequest(req: Request): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    if (!part.startsWith(`${SESSION_COOKIE}=`)) continue;
    const value = part.slice(SESSION_COOKIE.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

/** `link_abc12345` from a `/start` payload, or null. */
export function linkCodeFromStart(payload: string): string | null {
  const match = /^link_([a-z0-9]{8})$/i.exec(payload.trim());
  return match ? match[1].toLowerCase() : null;
}

export function botLinkUrl(code: string): string {
  return `https://t.me/BetweenJournalBot?start=link_${code}`;
}
