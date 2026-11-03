import { mergeStores } from "./journal-api";
import {
  getRedis,
  getUserTimezone,
  loadUserLocale,
  loadUserStore,
  rememberUser,
  saveUserLocale,
  saveUserStore,
  setUserTimezone,
} from "./redis";
import type { LocaleId } from "./i18n";
import type { OauthProvider } from "./oauth";
import {
  hashPassword,
  journalStorageId,
  newAccountId,
  newLinkCode,
  normalizeEmail,
  passwordMatches,
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
    createdAt: new Date().toISOString(),
    providers: {},
  };
  await redis.set(accountKey(id), account);
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

export async function issueBotLink(accountId: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const code = newLinkCode();
  await redis.set(linkKey(code), accountId, { ex: LINK_TTL_SECONDS });
  return code;
}

export type LinkResult = "ok" | "bad" | "taken";

/** Bind a Telegram user to the account that asked for this code. One journal after that. */
export async function claimTelegramLink(code: string, telegramUserId: number): Promise<LinkResult> {
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
    createdAt: new Date().toISOString(),
    providers: { [input.provider]: input.providerUserId },
  };
  await redis.set(accountKey(id), account);
  for (const subject of ids) await redis.set(oauthKey(input.provider, subject), id);
  return account;
}
