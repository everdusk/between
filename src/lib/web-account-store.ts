import { mergeStores } from "./journal-api";
import {
  getRedis,
  getUserTimezone,
  loadUserLocale,
  loadUserStore,
  loadWeekAccess,
  rememberUser,
  saveUserLocale,
  saveUserStore,
  saveWeekAccess,
  setUserTimezone,
} from "./redis";
import type { LocaleId } from "./i18n";
import type { OauthProvider } from "./oauth";
import { OTP_TTL_MS, otpMatches } from "./otp-mail";
import { absorbWeekPremium } from "./week-access";
import {
  hashPassword,
  hashResetToken,
  journalStorageId,
  newAccountId,
  newLinkCode,
  newResetToken,
  normalizeEmail,
  passwordMatches,
  RESET_TTL_SECONDS,
  reviewLoginFromEnv,
  webStorageId,
  LINK_TTL_SECONDS,
} from "./web-account";

export type AccountProviders = Partial<Record<OauthProvider, string>>;

export type AccountRecord = {
  id: string;
  email: string;
  salt: string;
  hash: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
  createdAt: string;
  providers: AccountProviders;
};

export type PublicAccount = {
  email: string;
  telegramLinked: boolean;
  providers: OauthProvider[];
};

function emailKey(email: string): string {
  return `between:acct:email:${email}`;
}

function accountKey(id: string): string {
  return `between:acct:${id}`;
}

function telegramKey(userId: number): string {
  return `between:acct:tg:${userId}`;
}

function linkKey(code: string): string {
  return `between:link:${code}`;
}

function otpKey(email: string): string {
  return `between:otp:${email}`;
}

function oauthKey(provider: OauthProvider, subject: string): string {
  return `between:acct:oauth:${provider}:${subject}`;
}

function readProviders(raw: unknown): AccountProviders {
  const out: AccountProviders = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["vk", "yandex", "sber"] as const) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

function asAccount(raw: unknown): AccountRecord | null {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<AccountRecord>;
  if (typeof row.id !== "string" || typeof row.email !== "string") return null;
  if (typeof row.salt !== "string" || typeof row.hash !== "string") return null;
  return {
    id: row.id,
    email: row.email,
    salt: row.salt,
    hash: row.hash,
    telegramUserId: typeof row.telegramUserId === "number" ? row.telegramUserId : null,
    telegramUsername:
      typeof row.telegramUsername === "string" && row.telegramUsername.trim()
        ? row.telegramUsername.trim().replace(/^@/, "")
        : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    providers: readProviders((row as { providers?: unknown }).providers),
  };
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function toPublicAccount(account: AccountRecord): PublicAccount {
  return {
    email: account.email,
    telegramLinked: account.telegramUserId != null,
    providers: (["vk", "yandex", "sber"] as const).filter((key) => Boolean(account.providers[key])),
  };
}

export async function loadAccount(id: string): Promise<AccountRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  return asAccount(await redis.get<unknown>(accountKey(id)));
}

export async function accountIdForTelegram(userId: number): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = await redis.get<string>(telegramKey(userId));
  return typeof id === "string" && id.startsWith("w") ? id : null;
}

export async function resolveJournalId(telegramUserId: number): Promise<string> {
  const accountId = await accountIdForTelegram(telegramUserId);
  return journalStorageId(telegramUserId, accountId);
}

export async function createAccount(
  email: string,
  password: string,
): Promise<AccountRecord | "taken" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = newAccountId();
  const claimed = await redis.set(emailKey(email), id, { nx: true });
  if (claimed !== "OK") return "taken";
  const passwordRecord = await hashPassword(password);
  const account: AccountRecord = {
    id,
    email,
    salt: passwordRecord.salt,
    hash: passwordRecord.hash,
    telegramUserId: null,
    telegramUsername: null,
    createdAt: new Date().toISOString(),
    providers: {},
  };
  await redis.set(accountKey(id), account);
  return account;
}

const OTP_RESEND_MS = 60_000;
const OTP_ATTEMPTS = 5;

type OtpRow = { hash: string; attempts: number; sentAt: number };

function asOtp(raw: unknown): OtpRow | null {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<OtpRow>;
  if (typeof row.hash !== "string" || typeof row.attempts !== "number" || typeof row.sentAt !== "number") {
    return null;
  }
  return { hash: row.hash, attempts: row.attempts, sentAt: row.sentAt };
}

/** Open the journal for this email, creating it when the person is new. */
export async function openAccountByEmail(email: string): Promise<AccountRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const existingId = await redis.get<string>(emailKey(email));
  if (typeof existingId === "string") {
    const existing = await loadAccount(existingId);
    if (existing) return existing;
  }
  const id = newAccountId();
  const claimed = await redis.set(emailKey(email), id, { nx: true });
  if (claimed !== "OK") {
    const winner = await redis.get<string>(emailKey(email));
    return typeof winner === "string" ? loadAccount(winner) : null;
  }
  const account: AccountRecord = {
    id,
    email,
    salt: "",
    hash: "",
    telegramUserId: null,
    telegramUsername: null,
    createdAt: new Date().toISOString(),
    providers: {},
  };
  await redis.set(accountKey(id), account);
  return account;
}

/** "soon" while the last code is less than a minute old. */
export async function otpSendAllowed(email: string, now = Date.now()): Promise<"ok" | "soon" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const row = asOtp(await redis.get<unknown>(otpKey(email)));
  if (row && now - row.sentAt < OTP_RESEND_MS) return "soon";
  return "ok";
}

export async function saveOtp(email: string, hash: string, now = Date.now()): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const row: OtpRow = { hash, attempts: 0, sentAt: now };
  await redis.set(otpKey(email), row, { ex: Math.ceil(OTP_TTL_MS / 1000) });
  return true;
}

export async function consumeOtp(
  email: string,
  code: string,
  secret: string,
): Promise<"ok" | "bad" | "missing" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = otpKey(email);
  const row = asOtp(await redis.get<unknown>(key));
  if (!row) return "missing";
  if (!otpMatches(code, secret, row.hash)) {
    const attempts = row.attempts + 1;
    if (attempts >= OTP_ATTEMPTS) await redis.del(key);
    else await redis.set(key, { ...row, attempts }, { ex: Math.ceil(OTP_TTL_MS / 1000) });
    return "bad";
  }
  await redis.del(key);
  return "ok";
}

type SignupRow = {
  salt: string;
  hash: string;
  codeHash: string;
  attempts: number;
  sentAt: number;
};

function signupKey(email: string): string {
  return `between:signup:${email}`;
}

function asSignup(raw: unknown): SignupRow | null {
  const value = typeof raw === "string" ? safeJson(raw) : raw;
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SignupRow>;
  if (
    typeof row.salt !== "string" ||
    typeof row.hash !== "string" ||
    typeof row.codeHash !== "string" ||
    typeof row.attempts !== "number" ||
    typeof row.sentAt !== "number"
  ) {
    return null;
  }
  return {
    salt: row.salt,
    hash: row.hash,
    codeHash: row.codeHash,
    attempts: row.attempts,
    sentAt: row.sentAt,
  };
}

export async function accountByEmail(email: string): Promise<AccountRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = await redis.get<string>(emailKey(email));
  if (typeof id !== "string") return null;
  return loadAccount(id);
}

/** "soon" while the last signup code is less than a minute old. */
export async function signupSendAllowed(email: string, now = Date.now()): Promise<"ok" | "soon" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const row = asSignup(await redis.get<unknown>(signupKey(email)));
  if (row && now - row.sentAt < OTP_RESEND_MS) return "soon";
  return "ok";
}

export async function saveSignup(
  email: string,
  salt: string,
  hash: string,
  codeHash: string,
  now = Date.now(),
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const row: SignupRow = { salt, hash, codeHash, attempts: 0, sentAt: now };
  await redis.set(signupKey(email), row, { ex: Math.ceil(OTP_TTL_MS / 1000) });
  return true;
}

/** Checks the signup code and returns the stored password hash. The password itself is not here. */
export async function consumeSignup(
  email: string,
  code: string,
  secret: string,
): Promise<{ salt: string; hash: string } | "bad" | "missing" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = signupKey(email);
  const row = asSignup(await redis.get<unknown>(key));
  if (!row) return "missing";
  if (!otpMatches(code, secret, row.codeHash)) {
    const attempts = row.attempts + 1;
    if (attempts >= OTP_ATTEMPTS) await redis.del(key);
    else await redis.set(key, { ...row, attempts }, { ex: Math.ceil(OTP_TTL_MS / 1000) });
    return "bad";
  }
  await redis.del(key);
  return { salt: row.salt, hash: row.hash };
}

export async function createVerifiedAccount(
  email: string,
  salt: string,
  hash: string,
): Promise<AccountRecord | "taken" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = newAccountId();
  const claimed = await redis.set(emailKey(email), id, { nx: true });
  if (claimed !== "OK") return "taken";
  const account: AccountRecord = {
    id,
    email,
    salt,
    hash,
    telegramUserId: null,
    telegramUsername: null,
    createdAt: new Date().toISOString(),
    providers: {},
  };
  await redis.set(accountKey(id), account);
  return account;
}

function resetWaitKey(email: string): string {
  return `between:reset-wait:${email}`;
}

function resetTokenKey(tokenHash: string): string {
  return `between:reset:${tokenHash}`;
}

function resetActiveKey(email: string): string {
  return `between:reset-active:${email}`;
}

function asMillis(raw: unknown): number | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

/** A fresh link, or "absent" when this email has no journal. The token is not a password. */
export async function prepareReset(
  email: string,
  now = Date.now(),
): Promise<{ token: string } | "soon" | "absent" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const waited = asMillis(await redis.get<unknown>(resetWaitKey(email)));
  if (waited != null && now - waited < OTP_RESEND_MS) return "soon";
  const id = await redis.get<string>(emailKey(email));
  if (typeof id !== "string") return "absent";
  const account = await loadAccount(id);
  if (!account) return "absent";
  const previous = await redis.get<string>(resetActiveKey(email));
  if (typeof previous === "string" && previous) await redis.del(resetTokenKey(previous));
  const token = newResetToken();
  const tokenHash = hashResetToken(token);
  await redis.set(resetTokenKey(tokenHash), account.id, { ex: RESET_TTL_SECONDS });
  await redis.set(resetActiveKey(email), tokenHash, { ex: RESET_TTL_SECONDS });
  return { token };
}

export async function finishResetMail(email: string, now = Date.now()): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(resetWaitKey(email), now, { ex: Math.ceil(OTP_RESEND_MS / 1000) });
}

export async function revokeReset(token: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !token) return;
  const tokenHash = hashResetToken(token);
  const id = await redis.get<string>(resetTokenKey(tokenHash));
  await redis.del(resetTokenKey(tokenHash));
  if (typeof id !== "string") return;
  const account = await loadAccount(id);
  if (!account?.email) return;
  const active = await redis.get<string>(resetActiveKey(account.email));
  if (active === tokenHash) await redis.del(resetActiveKey(account.email));
}

export async function completeReset(token: string, password: string): Promise<AccountRecord | "bad" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const tokenHash = hashResetToken(token);
  const id = await redis.get<string>(resetTokenKey(tokenHash));
  if (typeof id !== "string" || !id.startsWith("w")) return "bad";
  const account = await loadAccount(id);
  if (!account) return "bad";
  const passwordRecord = await hashPassword(password);
  account.salt = passwordRecord.salt;
  account.hash = passwordRecord.hash;
  await redis.set(accountKey(account.id), account);
  await redis.del(resetTokenKey(tokenHash));
  if (account.email) await redis.del(resetActiveKey(account.email));
  return account;
}

export async function loginAccount(
  email: string,
  password: string,
): Promise<AccountRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const id = await redis.get<string>(emailKey(email));
  if (typeof id !== "string") return null;
  const account = await loadAccount(id);
  if (!account) return null;
  const ok = await passwordMatches(password, account.salt, account.hash);
  return ok ? account : null;
}

/** Review credentials open or reset that one account. Everyone else uses their own password. */
export async function loginForSite(email: string, password: string): Promise<AccountRecord | null> {
  const review = reviewLoginFromEnv();
  if (review && email === review.email && password === review.password) {
    return ensureReviewAccount(email, password);
  }
  return loginAccount(email, password);
}

async function ensureReviewAccount(email: string, password: string): Promise<AccountRecord | null> {
  const redis = getRedis();
  if (!redis) return null;
  const existingId = await redis.get<string>(emailKey(email));
  if (typeof existingId === "string") {
    const account = await loadAccount(existingId);
    if (!account) return null;
    if (await passwordMatches(password, account.salt, account.hash)) return account;
    const passwordRecord = await hashPassword(password);
    account.salt = passwordRecord.salt;
    account.hash = passwordRecord.hash;
    await redis.set(accountKey(account.id), account);
    return account;
  }
  const created = await createAccount(email, password);
  return created && created !== "taken" ? created : null;
}

export async function issueBotLink(accountId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const code = newLinkCode();
  await redis.set(linkKey(code), accountId, { ex: LINK_TTL_SECONDS });
  return code;
}

export type LinkResult = "ok" | "bad" | "taken";

/** Bind a Telegram user to the account that asked for this code. One journal after that. */
export async function claimTelegramLink(
  code: string,
  telegramUserId: number,
  username?: string,
): Promise<LinkResult> {
  const redis = getRedis();
  if (!redis) return "bad";
  const accountId = await redis.get<string>(linkKey(code.toLowerCase()));
  if (typeof accountId !== "string" || !accountId.startsWith("w")) return "bad";
  await redis.del(linkKey(code.toLowerCase()));

  const account = await loadAccount(accountId);
  if (!account) return "bad";
  if (account.telegramUserId != null && account.telegramUserId !== telegramUserId) return "taken";

  const existing = await accountIdForTelegram(telegramUserId);
  if (existing && existing !== accountId) return "taken";

  const webId = webStorageId(accountId);
  if (account.telegramUserId == null) {
    const telegramAccess = await loadWeekAccess(telegramUserId);
    const absorbed = absorbWeekPremium(await loadWeekAccess(webId), telegramAccess, new Date());
    await saveWeekAccess(webId, absorbed.web);
    if (absorbed.telegram.paidUntil !== telegramAccess.paidUntil) {
      await saveWeekAccess(telegramUserId, absorbed.telegram);
    }
  }

  const merged = mergeStores(
    await loadUserStore(webId),
    await loadUserStore(telegramUserId),
  );
  await saveUserStore(webId, merged);

  const webTz = await getUserTimezone(webId);
  if (!webTz) {
    const tz = await getUserTimezone(telegramUserId);
    if (tz) await setUserTimezone(webId, tz);
  }
  const webLocale = await loadUserLocale(webId);
  if (!webLocale) {
    const locale = await loadUserLocale(telegramUserId);
    if (locale) await saveUserLocale(webId, locale as LocaleId);
  }

  account.telegramUserId = telegramUserId;
  const handle = username?.trim().replace(/^@/, "");
  if (handle) account.telegramUsername = handle;
  await redis.set(accountKey(accountId), account);
  await redis.set(telegramKey(telegramUserId), accountId);
  await rememberUser(telegramUserId);
  return "ok";
}

export async function upsertOauthAccount(input: {
  provider: OauthProvider;
  providerUserId: string;
  altIds?: string[];
  email: string | null;
}): Promise<AccountRecord | "taken" | null> {
  const redis = getRedis();
  if (!redis) return null;
  const email = input.email ? normalizeEmail(input.email) : null;
  const ids = [input.providerUserId, ...(input.altIds ?? [])].filter(
    (id, index, all) => id && all.indexOf(id) === index,
  );
  let found: AccountRecord | null = null;
  for (const subject of ids) {
    const accountId = await redis.get<string>(oauthKey(input.provider, subject));
    if (typeof accountId !== "string") continue;
    const account = await loadAccount(accountId);
    if (!account) continue;
    if (found && found.id !== account.id) return "taken";
    found = account;
  }
  if (!found && email) {
    const existingId = await redis.get<string>(emailKey(email));
    if (typeof existingId === "string") found = await loadAccount(existingId);
  }
  if (found) {
    const current = found.providers[input.provider];
    if (current && !ids.includes(current)) return "taken";
    found.providers = { ...found.providers, [input.provider]: input.providerUserId };
    if (!found.email && email) {
      const claimed = await redis.set(emailKey(email), found.id, { nx: true });
      if (claimed === "OK") found.email = email;
    }
    await redis.set(accountKey(found.id), found);
    for (const subject of ids) await redis.set(oauthKey(input.provider, subject), found.id);
    return found;
  }

  const id = newAccountId();
  if (email) {
    const claimed = await redis.set(emailKey(email), id, { nx: true });
    if (claimed !== "OK") {
      const winner = await redis.get<string>(emailKey(email));
      if (typeof winner !== "string") return "taken";
      const account = await loadAccount(winner);
      if (!account) return "taken";
      return upsertOauthAccount({ ...input, email });
    }
  }
  const account: AccountRecord = {
    id,
    email: email ?? "",
    salt: "",
    hash: "",
    telegramUserId: null,
    telegramUsername: null,
    createdAt: new Date().toISOString(),
    providers: { [input.provider]: input.providerUserId },
  };
  await redis.set(accountKey(id), account);
  for (const subject of ids) await redis.set(oauthKey(input.provider, subject), id);
  return account;
}
