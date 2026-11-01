import { createHmac } from "node:crypto";
import {
  ANALYTICS_EVENTS,
  analyticsCohortKey,
  analyticsCount,
  analyticsCounterKey,
  analyticsDedupKey,
  emptyAnalyticsCounts,
  reportDaySpan,
  shiftDay,
  snapshotFromReads,
  type AnalyticsEvent,
  type AnalyticsSnapshot,
} from "./analytics-model";
import { getRedis } from "./redis";
import { DEFAULT_TIME_ZONE } from "./types";
import { todayInTimeZone } from "./zoned";

export type { AnalyticsEvent, AnalyticsSnapshot };
export {
  acceptClientEvent,
  formatAnalyticsReport,
  isAnalyticsOwner,
} from "./analytics-model";

const DEDUP_TTL_SEC = 3 * 24 * 60 * 60;
const PAID_DEDUP_TTL_SEC = 40 * 24 * 60 * 60;
const COUNTER_TTL_SEC = 400 * 24 * 60 * 60;

export type AnalyticsRedis = {
  sadd: (key: string, member: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  incr: (key: string) => Promise<number>;
  mget: (...keys: string[]) => Promise<(number | string | null)[]>;
};

/** Hex mark for “this event already happened”. The Telegram id is not in the key. */
export function analyticsDedupToken(pepper: string, material: string): string {
  return createHmac("sha256", pepper).update(material).digest("hex");
}

export async function recordAnalytics(
  redis: AnalyticsRedis,
  input: {
    userId: number;
    event: AnalyticsEvent;
    day: string;
    cohort?: string;
    offset?: number;
    /** Payment charge id. Same charge is counted once, even if Telegram retries. */
    salt?: string;
    pepper: string;
  },
): Promise<"counted" | "duplicate"> {
  const material = input.salt
    ? `${input.userId}:${input.event}:${input.salt}`
    : `${input.userId}:${input.event}:${input.day}`;
  const token = analyticsDedupToken(input.pepper, material);
  const dedupKey = input.salt ? "between:analytics:dedup:paid" : analyticsDedupKey(input.day);
  const added = await redis.sadd(dedupKey, token);
  await redis.expire(dedupKey, input.salt ? PAID_DEDUP_TTL_SEC : DEDUP_TTL_SEC);
  if (added === 0) return "duplicate";

  const keys = [analyticsCounterKey(input.day, input.event)];
  if (input.event === "visit" && input.cohort && input.offset != null) {
    keys.push(analyticsCohortKey(input.cohort, input.offset));
  }
  for (const key of keys) {
    await redis.incr(key);
    await redis.expire(key, COUNTER_TTL_SEC);
  }
  return "counted";
}

export async function loadAnalyticsReport(
  redis: AnalyticsRedis,
  now = new Date(),
): Promise<AnalyticsSnapshot> {
  const today = todayInTimeZone(DEFAULT_TIME_ZONE, now);
  const { reportDays, cohortDays: cohortSpan } = reportDaySpan();
  const days: string[] = [];
  for (let ago = reportDays - 1; ago >= 0; ago -= 1) {
    const day = shiftDay(today, -ago);
    if (day) days.push(day);
  }
  const cohortDays: string[] = [];
  for (let ago = cohortSpan - 1; ago >= 0; ago -= 1) {
    const day = shiftDay(today, -ago);
    if (day) cohortDays.push(day);
  }

  const keys: string[] = [];
  for (const day of days) {
    for (const event of ANALYTICS_EVENTS) keys.push(analyticsCounterKey(day, event));
  }
  for (const day of cohortDays) {
    keys.push(analyticsCohortKey(day, 0), analyticsCohortKey(day, 1), analyticsCohortKey(day, 7));
  }
  const raw = keys.length ? await redis.mget(...keys) : [];

  let cursor = 0;
  const dayCounts = days.map((day) => {
    const counts = emptyAnalyticsCounts();
    for (const event of ANALYTICS_EVENTS) {
      counts[event] = analyticsCount(raw[cursor]);
      cursor += 1;
    }
    return { day, counts };
  });
  const cohorts = cohortDays.map((day) => {
    const row = {
      day,
      d0: analyticsCount(raw[cursor]),
      d1: analyticsCount(raw[cursor + 1]),
      d7: analyticsCount(raw[cursor + 2]),
    };
    cursor += 3;
    return row;
  });
  return snapshotFromReads(today, dayCounts, cohorts);
}

export function analyticsRedis(): AnalyticsRedis | null {
  const redis = getRedis();
  if (!redis) return null;
  return {
    sadd: (key, member) => redis.sadd(key, member),
    expire: (key, seconds) => redis.expire(key, seconds),
    incr: (key) => redis.incr(key),
    mget: (...keys) => redis.mget<(number | string | null)[]>(...keys),
  };
}

export async function recordPaidAnalytics(
  userId: number,
  chargeId: string | undefined,
  now = new Date(),
): Promise<void> {
  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim();
  if (!redis || !pepper) return;
  const day = todayInTimeZone(DEFAULT_TIME_ZONE, now);
  await recordAnalytics(redis, {
    userId,
    event: "paid",
    day,
    salt: chargeId || undefined,
    pepper,
  });
}
