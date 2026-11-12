import { createHmac } from "node:crypto";
import {
  ANALYTICS_EVENTS,
  ANALYTICS_MESSENGERS,
  WEEK_RETURN_OFFSET,
  analyticsCohortKey,
  analyticsCount,
  analyticsCounterKey,
  analyticsDedupKey,
  emptyAnalyticsCounts,
  reportDaySpan,
  shiftDay,
  analyticsQuiet,
  snapshotFromReads,
  sumCountRows,
  type AnalyticsEvent,
  type AnalyticsMessenger,
  type AnalyticsSnapshot,
  type MessengerReport,
  type ProductPlan,
} from "./analytics-model";
import { captureServerProduct, captureServerSubscribe } from "./product-analytics-server";
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
    userId: number | string;
    event: AnalyticsEvent;
    messenger: AnalyticsMessenger;
    day: string;
    cohort?: string;
    offset?: number;
    /** Payment charge id. Same charge is counted once, even if Telegram retries. */
    salt?: string;
    pepper: string;
  },
): Promise<"counted" | "duplicate"> {
  const material = input.salt
    ? `${input.messenger}:${input.userId}:${input.event}:${input.salt}`
    : `${input.messenger}:${input.userId}:${input.event}:${input.day}`;
  const token = analyticsDedupToken(input.pepper, material);
  const dedupKey = input.salt ? "between:analytics:dedup:paid" : analyticsDedupKey(input.day);
  const added = await redis.sadd(dedupKey, token);
  if (String(added) === "0") return "duplicate";

  const keys = [analyticsCounterKey(input.day, input.event, input.messenger)];
  if (input.event === "visit" && input.cohort && input.offset === 0) {
    keys.push(analyticsCohortKey(input.cohort, 0, input.messenger));
  }
  if (
    input.event === "visit" &&
    input.cohort &&
    input.offset != null &&
    input.offset >= 1 &&
    input.offset <= 7
  ) {
    const mark = analyticsDedupToken(
      input.pepper,
      `${input.messenger}:${input.userId}:week:${input.cohort}`,
    );
    const seen = await redis.sadd(`between:analytics:return:${input.messenger}:${input.cohort}`, mark);
    await redis
      .expire(`between:analytics:return:${input.messenger}:${input.cohort}`, COUNTER_TTL_SEC)
      .catch(() => undefined);
    if (seen === 1) {
      keys.push(analyticsCohortKey(input.cohort, WEEK_RETURN_OFFSET, input.messenger));
    }
  }
  for (const key of keys) {
    await redis.incr(key);
    await redis.expire(key, COUNTER_TTL_SEC).catch(() => undefined);
  }
  await redis.expire(dedupKey, input.salt ? PAID_DEDUP_TTL_SEC : DEDUP_TTL_SEC).catch(() => undefined);
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
  for (const messenger of ANALYTICS_MESSENGERS) {
    for (const day of days) {
      for (const event of ANALYTICS_EVENTS) keys.push(analyticsCounterKey(day, event, messenger));
    }
  }
  for (const day of days) {
    for (const event of ANALYTICS_EVENTS) keys.push(analyticsCounterKey(day, event));
  }
  for (const messenger of ANALYTICS_MESSENGERS) {
    for (const day of cohortDays) {
      keys.push(
        analyticsCohortKey(day, 0, messenger),
        analyticsCohortKey(day, WEEK_RETURN_OFFSET, messenger),
      );
    }
  }
  for (const day of cohortDays) {
    keys.push(analyticsCohortKey(day, 0), analyticsCohortKey(day, WEEK_RETURN_OFFSET));
  }
  const raw = keys.length ? await redis.mget(...keys) : [];

  let cursor = 0;
  const readDays = () =>
    days.map((day) => {
      const counts = emptyAnalyticsCounts();
      for (const event of ANALYTICS_EVENTS) {
        counts[event] = analyticsCount(raw[cursor]);
        cursor += 1;
      }
      return { day, counts };
    });
  const readCohorts = () =>
    cohortDays.map((day) => {
      const row = {
        day,
        d0: analyticsCount(raw[cursor]),
        week: analyticsCount(raw[cursor + 1]),
      };
      cursor += 2;
      return row;
    });

  const byMessenger = {
    telegram: readDays(),
    max: readDays(),
    web: readDays(),
  };
  const legacyDays = readDays();
  const cohorts = {
    telegram: readCohorts(),
    max: readCohorts(),
    web: readCohorts(),
  };
  const legacyCohorts = readCohorts();
  byMessenger.telegram = sumCountRows(byMessenger.telegram, legacyDays);
  cohorts.telegram = cohorts.telegram.map((row, index) => ({
    day: row.day,
    d0: row.d0 + legacyCohorts[index].d0,
    week: row.week + legacyCohorts[index].week,
  }));

  const messengers = {} as AnalyticsSnapshot["messengers"];
  for (const messenger of ANALYTICS_MESSENGERS) {
    const shot = snapshotFromReads(today, byMessenger[messenger], cohorts[messenger]);
    const part: MessengerReport = {
      todayCounts: shot.todayCounts,
      totals: shot.totals,
      cohorts: shot.cohorts,
    };
    messengers[messenger] = part;
  }
  return { today, windowDays: days.length, messengers };
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
  username?: string | null,
): Promise<void> {
  if (
    analyticsQuiet({
      username,
      userId,
      messenger: "telegram",
      owners: process.env.ANALYTICS_OWNERS,
    })
  ) {
    return;
  }
  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim();
  if (!redis || !pepper) return;
  const day = todayInTimeZone(DEFAULT_TIME_ZONE, now);
  await recordAnalytics(redis, {
    userId,
    event: "paid",
    messenger: "telegram",
    day,
    salt: chargeId || undefined,
    pepper,
  });
}

const SBP_BOOKED_KEY = "between:analytics:sbp-booked";

/** The charge was written to the paid counter, or it was not one of ours. */
export async function rememberSbpPayment(paymentId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !paymentId) return;
  await redis.sadd(SBP_BOOKED_KEY, paymentId);
  await redis.expire(SBP_BOOKED_KEY, COUNTER_TTL_SEC);
}

export async function sbpPaymentBooked(paymentId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !paymentId) return false;
  const seen = await redis.sismember(SBP_BOOKED_KEY, paymentId);
  return Number(seen) === 1;
}

/** One confirmed SBP charge in the paid counter. The same charge is counted once. Detail stays in PostHog. */
export async function recordSbpPaid(input: {
  userId: string;
  messenger: AnalyticsMessenger;
  plan: ProductPlan;
  paymentId: string;
  step: "paid" | "pending";
  at?: Date;
}): Promise<"counted" | "duplicate" | "skipped"> {
  if (
    analyticsQuiet({
      userId: input.userId,
      messenger: input.messenger,
      owners: process.env.ANALYTICS_OWNERS,
    })
  ) {
    return "skipped";
  }
  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!redis || !pepper) return "skipped";
  try {
    const result = await recordAnalytics(redis, {
      userId: input.userId,
      event: "paid",
      messenger: input.messenger,
      day: todayInTimeZone(DEFAULT_TIME_ZONE, input.at),
      salt: input.paymentId,
      pepper,
    });
    if (result === "counted") {
      await captureServerSubscribe({
        messenger: input.messenger,
        step: input.step,
        plan: input.plan,
        actorId: input.userId,
      });
    }
    await rememberSbpPayment(input.paymentId);
    return result;
  } catch {
    return "skipped";
  }
}

/** A bot step. The mini app reports the same person through `/api/analytics`. One person, one step, one messenger, one day. */
export async function trackServerEvent(input: {
  userId: number | string;
  event: AnalyticsEvent;
  messenger: AnalyticsMessenger;
  username?: string | null;
}): Promise<void> {
  if (
    analyticsQuiet({
      username: input.username,
      userId: input.userId,
      messenger: input.messenger,
      owners: process.env.ANALYTICS_OWNERS,
    })
  ) {
    return;
  }
  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  let counted = !redis || !pepper;
  try {
    if (redis && pepper) {
      const result = await recordAnalytics(redis, {
        userId: input.userId,
        event: input.event,
        messenger: input.messenger,
        day: todayInTimeZone(DEFAULT_TIME_ZONE),
        pepper,
      });
      counted = result === "counted";
    }
  } catch {
    // The reply is already on its way. A missed counter can wait for the next message.
    counted = false;
  }
  if (counted) await captureServerProduct(input);
}
