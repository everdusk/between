import { Redis } from "@upstash/redis";
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
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(briefKey(userId, stamp), text, { ex: 60 * 60 * 24 * 21 });
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

/** Returns false when the user already used the daily free model budget. */
export async function takeBriefAttempt(
  userId: number | string,
  dateKey: string,
  limit = 8,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const key = briefCountKey(userId, dateKey);
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

function webLoginKey(token: string): string {
  return `between:web-login:${token}`;
}

export async function saveWebLogin(
  token: string,
  userId: number,
  name: string,
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(webLoginKey(token), { userId, name: name.slice(0, 120) }, { ex: 10 * 60 });
  return true;
}

export async function takeWebLogin(
  token: string,
): Promise<{ userId: number; name: string } | null> {
  const redis = getRedis();
  if (!redis) return null;
  const key = webLoginKey(token);
  const raw = await redis.get<unknown>(key);
  if (raw == null) return null;
  await redis.del(key);
  let record: { userId?: unknown; name?: unknown };
  if (typeof raw === "string") {
    try {
      record = JSON.parse(raw) as { userId?: unknown; name?: unknown };
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    record = raw as { userId?: unknown; name?: unknown };
  } else {
    return null;
  }
  const userId = typeof record.userId === "number" ? record.userId : Number(record.userId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  const name = typeof record.name === "string" ? record.name.slice(0, 120) : "";
  return { userId, name };
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
