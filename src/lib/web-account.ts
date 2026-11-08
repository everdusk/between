import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "between_session";
export const LOGIN_COOKIE = "between_login";
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

/** Site login for a reviewer. Empty or a short password means the door stays shut. */
export function reviewLoginFromEnv(
  env: Record<string, string | undefined> = process.env,
): { email: string; password: string } | null {
  const email = normalizeEmail(env.REVIEW_EMAIL);
  const password = env.REVIEW_PASSWORD ?? "";
  if (!email || passwordProblem(password)) return null;
  return { email, password };
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

export type SessionClaims = { accountId: string; version: number };

export function signSession(
  accountId: string,
  secret: string,
  now = Date.now(),
  version = 0,
): string {
  const payload = Buffer.from(`${accountId}.${version}.${now + SESSION_MS}`).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readSessionClaims(
  token: string,
  secret: string,
  now = Date.now(),
): SessionClaims | null {
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
  const parts = decoded.split(".");
  let accountId: string;
  let version = 0;
  let exp = Number.NaN;
  if (parts.length === 2) {
    accountId = parts[0] ?? "";
    exp = Number(parts[1]);
  } else if (parts.length === 3) {
    accountId = parts[0] ?? "";
    version = Number(parts[1]);
    exp = Number(parts[2]);
  } else {
    return null;
  }
  if (!accountId.startsWith("w") || !Number.isInteger(version) || version < 0) return null;
  if (!Number.isFinite(exp) || exp < now) return null;
  return { accountId, version };
}

export function readSession(token: string, secret: string, now = Date.now()): string | null {
  return readSessionClaims(token, secret, now)?.accountId ?? null;
}

/** Ties a messenger login poll to the browser that asked for it. */
export function loginChallenge(token: string, secret: string): string {
  return createHmac("sha256", secret).update(`login.${token}`).digest("base64url");
}

export function loginChallengeMatches(
  cookie: string | null,
  token: string,
  secret: string,
): boolean {
  if (!cookie) return false;
  const expected = loginChallenge(token, secret);
  const left = Buffer.from(cookie);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    if (!part.startsWith(`${name}=`)) continue;
    const value = part.slice(name.length + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function sessionTokenFromRequest(req: Request): string | null {
  return cookieValue(req.headers.get("cookie"), SESSION_COOKIE);
}

/** `link_abc12345` from a `/start` payload, or null. */
export function linkCodeFromStart(payload: string): string | null {
  const match = /^link_([a-z0-9]{8})$/i.exec(payload.trim());
  return match ? match[1].toLowerCase() : null;
}

export function botLinkUrl(code: string): string {
  return `https://t.me/BetweenJournalBot?start=link_${code}`;
}

/** Journal key for a MAX user who has not linked a site account. Never a bare number. */
export function maxStorageId(userId: number): string {
  return `max:${userId}`;
}

/** Public nick without @. Self-employed bots get a name like `se123_bot`. */
export function maxBotUsername(): string | null {
  const name = process.env.MAX_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{3,64}$/.test(name)) return null;
  return name;
}

export function maxBotReady(): boolean {
  return Boolean(process.env.MAX_BOT_TOKEN?.trim() && maxBotUsername());
}

/** Opens the bot chat. `bot_started.payload` arrives as `link_<code>`. */
export function maxBotLinkUrl(code: string): string | null {
  const name = maxBotUsername();
  if (!name) return null;
  return `https://max.ru/${name}?start=${encodeURIComponent(`link_${code}`)}`;
}

export function newMaxLoginToken(): string {
  const bytes = randomBytes(32);
  let token = "";
  for (let i = 0; i < 32; i += 1) token += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return token;
}

/** `login_<32 chars>` from a bot start payload, or null. */
export function loginTokenFromStart(payload: string): string | null {
  const match = /^login_([a-z0-9]{32})$/i.exec(payload.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * Opens the bot in the MAX web client. The max.ru page's "Запустить бота" is a
 * `max://` link, and a desktop browser does nothing with it.
 */
export function maxBotLoginUrl(token: string): string | null {
  const name = maxBotUsername();
  if (!name) return null;
  return `https://web.max.ru/${name}?start=${encodeURIComponent(`login_${token}`)}`;
}

/** Same confirmation as MAX, through the Telegram bot that already exists. */
export function telegramBotLoginUrl(token: string): string {
  return `https://t.me/BetweenJournalBot?start=login_${token}`;
}

export const RESET_TTL_SECONDS = 30 * 60;

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function resetUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/reset?token=${encodeURIComponent(token)}`;
}
