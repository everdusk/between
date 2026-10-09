import { Redis } from "@upstash/redis";
import { normalizeStore } from "./migrate";
import { emptyStore, type TherapyStore } from "./types";

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
