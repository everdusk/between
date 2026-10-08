import { Redis } from "@upstash/redis";
import { emptyStore, type TherapyStore } from "./types";

let client: Redis | null = null;

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

function isStore(value: unknown): value is TherapyStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.entries) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.weekPreps)
  );
}

export async function loadUserStore(
  userId: number | string,
): Promise<TherapyStore> {
  const redis = getRedis();
  if (!redis) return emptyStore();
  const raw = await redis.get<TherapyStore | string>(storeKey(userId));
  if (!raw) return emptyStore();
  const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!isStore(parsed)) return emptyStore();
  return parsed;
}

export async function saveUserStore(
  userId: number | string,
  store: TherapyStore,
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("Redis is not configured");
  }
  await redis.set(storeKey(userId), store);
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
}
