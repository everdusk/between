import { Redis } from "@upstash/redis";
import { parseDigestRun, type DigestRun } from "./digest";
import { isLocale, type LocaleId } from "./i18n";
import { normalizeStore } from "./migrate";
import { emptyStore, type TherapyStore } from "./types";
import {
  emptyWeekAccess,
  normalizeWeekAccess,
  type WeekAccessRecord,
} from "./week-access";

let client: Redis | null = null;

const USERS_KEY = "between:users";
const BLOCKED_KEY = "between:bots:blocked";
const QUIET_KEY = "between:stats:quiet";

export function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function getRedis(): Redis | null {
  if (!redisConfigured()) return null;
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}

function storeKey(userId: number | string): string {
  return `between:user:${userId}:store`;
}

function tzKey(userId: number | string): string {
  return `between:user:${userId}:tz`;
}

function digestKey(userId: number | string, dateKey: string, slot: string): string {
  return `between:digest:${userId}:${dateKey}:${slot}`;
}

function briefKey(userId: number | string, stamp: string): string {
  return `between:user:${userId}:brief:${stamp}`;
}

function latestBriefKey(userId: number | string, kind: string): string {
  return `between:user:${userId}:brief-latest:${kind}`;
}

function briefCountKey(userId: number | string, dateKey: string): string {
  return `between:user:${userId}:brief-count:${dateKey}`;
}

function weekAccessKey(userId: number | string): string {
  return `between:user:${userId}:week-access`;
}

function localeKey(userId: number | string): string {
  return `between:user:${userId}:locale`;
}

function deviceLocaleKey(userId: number | string): string {
  return `between:user:${userId}:device-locale`;
}

function botIntroKey(userId: number | string): string {
  return `between:user:${userId}:bot-intro`;
}

export async function rememberUser(userId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.sadd(USERS_KEY, String(userId));
}

export async function listUserIds(): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  const ids = await redis.smembers(USERS_KEY);
  return ids.map((id) => String(id));
}

export async function loadUserStore(
  userId: number | string,
): Promise<TherapyStore> {
  const redis = getRedis();
  if (!redis) return emptyStore();
  const raw = await redis.get<unknown>(storeKey(userId));
  if (!raw) return emptyStore();
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  return normalizeStore(parsed) ?? emptyStore();
}

export async function saveUserStore(
  userId: number | string,
  store: TherapyStore,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not configured");
  }
  const normalized = normalizeStore(store) ?? store;
  await redis.set(storeKey(userId), normalized);
  await rememberUser(userId);
}

export async function getUserTimezone(
  userId: number | string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const tz = await redis.get<string>(tzKey(userId));
  return tz || null;
}

export async function setUserTimezone(
  userId: number | string,
  timeZone: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(tzKey(userId), timeZone);
  await rememberUser(userId);
}

/** True when this process claimed the slot and should send. */
export async function claimDigestSlot(
  userId: number | string,
  dateKey: string,
  slot: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const result = await redis.set(digestKey(userId, dateKey, slot), "1", {
    nx: true,
    ex: 60 * 60 * 36,
  });
  return result === "OK";
}

export async function releaseDigestSlot(
  userId: number | string,
  dateKey: string,
  slot: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(digestKey(userId, dateKey, slot));
}

/** True when this slot's message was accepted and the claim was kept. */
export async function digestSlotHeld(
  userId: number | string,
  dateKey: string,
  slot: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const value = await redis.get(digestKey(userId, dateKey, slot));
  return value != null && value !== "";
}

/** A person who blocked or stopped the bot. They are not part of today's poll audience. */
export async function rememberBotBlocked(userId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.sadd(BLOCKED_KEY, String(userId));
}

export async function forgetBotBlocked(userId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.srem(BLOCKED_KEY, String(userId));
}

export async function listBlockedBots(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set();
  const ids = await redis.smembers(BLOCKED_KEY);
  return new Set(ids.map((id) => String(id)));
}

/** Chats of the person who reads /stats. They stay out of the poll block. */
export async function rememberStatsQuiet(userId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.sadd(QUIET_KEY, String(userId));
}

export async function listStatsQuiet(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set();
  const ids = await redis.smembers(QUIET_KEY);
  return new Set(ids.map((id) => String(id)));
}

const DIGEST_RUN_KEY = "between:digest:last-run";

export async function saveDigestRun(run: DigestRun): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(DIGEST_RUN_KEY, run, { ex: 60 * 60 * 24 * 14 });
}

export async function loadDigestRun(): Promise<DigestRun | null> {
  const redis = getRedis();
  if (!redis) return null;
  return parseDigestRun(await redis.get(DIGEST_RUN_KEY));
}

export async function getCachedBrief(
  userId: number | string,
  stamp: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const text = await redis.get<string>(briefKey(userId, stamp));
  return text || null;
}

export async function cacheBrief(
  userId: number | string,
  stamp: string,
  text: string,
  kind?: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const ttl = 60 * 60 * 24 * 21;
  await redis.set(briefKey(userId, stamp), text, { ex: ttl });
  if (kind === "pattern" || kind === "brief") {
    await redis.set(latestBriefKey(userId, kind), text, { ex: ttl });
  }
}

/** Last successful paragraph for this kind, when the exact stamp is not cached. */
export async function getLatestBrief(
  userId: number | string,
  kind: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const text = await redis.get<string>(latestBriefKey(userId, kind));
  return text || null;
}

export async function loadWeekAccess(userId: number | string): Promise<WeekAccessRecord> {
  const redis = getRedis();
  if (!redis) return emptyWeekAccess();
  const raw = await redis.get<unknown>(weekAccessKey(userId));
  return normalizeWeekAccess(raw);
}

export async function saveWeekAccess(
  userId: number | string,
  record: WeekAccessRecord,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(weekAccessKey(userId), normalizeWeekAccess(record));
}

function briefCountRedisKey(userId: number | string, dateKey: string, bucket = ""): string {
  const base = briefCountKey(userId, dateKey);
  return bucket ? `${base}:${bucket}` : base;
}

/** Returns false when the user already used this bucket's daily model budget. */
export async function takeBriefAttempt(
  userId: number | string,
  dateKey: string,
  limit = 8,
  bucket = "",
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const key = briefCountRedisKey(userId, dateKey, bucket);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60 * 60 * 48);
  return count <= limit;
}

async function readLocale(key: string): Promise<LocaleId | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.get<string>(key);
  return isLocale(value) ? value : null;
}

export async function loadUserLocale(userId: number | string): Promise<LocaleId | null> {
  return readLocale(localeKey(userId));
}

export async function saveUserLocale(userId: number | string, locale: LocaleId): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(localeKey(userId), locale);
}

export async function loadDeviceLocale(userId: number | string): Promise<LocaleId | null> {
  return readLocale(deviceLocaleKey(userId));
}

export async function saveDeviceLocale(userId: number | string, locale: LocaleId): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(deviceLocaleKey(userId), locale);
}

/** True the first time this account should receive the bot hello. */
export async function claimBotIntro(userId: number | string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const result = await redis.set(botIntroKey(userId), "1", { nx: true });
  return result === "OK";
}

/** One Telegram charge extends access once. A replay of the same id does not. */
export async function claimPaymentCharge(chargeId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !chargeId) return false;
  const result = await redis.set(`between:pay:${chargeId}`, "1", {
    nx: true,
    ex: 60 * 60 * 24 * 400,
  });
  return result === "OK";
}

export async function releasePaymentCharge(chargeId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !chargeId) return;
  await redis.del(`between:pay:${chargeId}`);
}

export async function releaseBotIntro(userId: number | string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(botIntroKey(userId));
}

/** Keeps a language seen from Telegram until the Mini App reports the device. */
export async function rememberDeviceLocale(
  userId: number | string,
  locale: LocaleId,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = deviceLocaleKey(userId);
  const existing = await redis.get<string>(key);
  if (isLocale(existing)) return;
  await redis.set(key, locale);
}
