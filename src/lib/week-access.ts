export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_PERIOD_SEC = 2_592_000;
export const DEFAULT_STAR_PRICE = 150;
export const WEEK_INVOICE_PAYLOAD = "between-week";

/**
 * Telegram Stars subscriptions only allow a 30-day period.
 * Quarter and year are one-time invoices with their own payloads.
 */
export const WEEK_PLAN_PAYLOAD = {
  month: WEEK_INVOICE_PAYLOAD,
  quarter: "between-week-quarter",
  year: "between-week-year",
} as const;

/** Gifted premium. Finite spans start when the account is first seen. */
export type PremiumSpan = "month" | "quarter" | "year" | "forever";
export type PremiumPlan = "month" | "quarter" | "year";

export const PREMIUM_SPAN_DAYS: Record<Exclude<PremiumSpan, "forever">, number> = {
  month: 30,
  quarter: 90,
  year: 365,
};

/** Usernames without @. `WEEK_EXEMPT_USER_IDS` adds extra forever ids. */
export const PREMIUM_WHITELIST: Readonly<Record<string, PremiumSpan>> = {
  aliatorovskaia: "forever",
};

/** Telegram accounts that keep «Неделя» open after the trial, without Stars. */
export const WEEK_ACCESS_EXEMPT_USER_IDS: readonly number[] = [];

export type WeekAccessIdentity = {
  id: number;
  username?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekAccessRecord = {
  openedAt: string | null;
  paidUntil: string | null;
  introSeen: boolean;
  /** First time a finite whitelist span was applied. Forever does not use it. */
  grantFrom: string | null;
};

export type WeekAccessStatus = "new" | "trial" | "paid" | "locked";
export type PremiumKind = "none" | "timed" | "forever";

export type WeekAccessView = {
  status: WeekAccessStatus;
  openedAt: string | null;
  paidUntil: string | null;
  trialEndsAt: string | null;
  introSeen: boolean;
  /** Remaining free-trial days. Zero once the week is paid or locked. */
  daysLeft: number;
  /** Paid Stars or an active whitelist grant. The free trial is not premium. */
  premium: PremiumKind;
  premiumDaysLeft: number;
  starPrice: number;
  prices: { month: number; quarter: number; year: number };
};

export function emptyWeekAccess(): WeekAccessRecord {
  return { openedAt: null, paidUntil: null, introSeen: false, grantFrom: null };
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export function normalizeWeekAccess(raw: unknown): WeekAccessRecord {
  if (!raw || typeof raw !== "object") return emptyWeekAccess();
  const record = raw as Record<string, unknown>;
  return {
    openedAt: isoOrNull(record.openedAt),
    paidUntil: isoOrNull(record.paidUntil),
    introSeen: record.introSeen === true,
    grantFrom: isoOrNull(record.grantFrom),
  };
}

export function planFromPayload(payload: string | undefined): PremiumPlan | null {
  if (payload === WEEK_PLAN_PAYLOAD.month) return "month";
  if (payload === WEEK_PLAN_PAYLOAD.quarter) return "quarter";
  if (payload === WEEK_PLAN_PAYLOAD.year) return "year";
  return null;
}

export function planDays(plan: PremiumPlan): number {
  return PREMIUM_SPAN_DAYS[plan];
}

/** Month is full price. Quarter is 20% off three months. Year is 50% off twelve. */
export function planPrice(monthly: number, plan: PremiumPlan): number {
  const base = Number.isInteger(monthly) && monthly > 0 ? monthly : DEFAULT_STAR_PRICE;
  if (plan === "month") return base;
  if (plan === "quarter") return Math.round(base * 3 * 0.8);
  return Math.round(base * 12 * 0.5);
}

export function paidUntilForPlan(
  plan: PremiumPlan,
  now: Date,
  subscriptionExpirationSec?: number,
): string {
  if (
    plan === "month" &&
    typeof subscriptionExpirationSec === "number" &&
    subscriptionExpirationSec > 0
  ) {
    return new Date(subscriptionExpirationSec * 1000).toISOString();
  }
  return new Date(now.getTime() + planDays(plan) * DAY_MS).toISOString();
}

function usernameKey(username: string | undefined): string {
  return username?.trim().replace(/^@/, "").toLowerCase() ?? "";
}

export function whitelistSpan(
  user: WeekAccessIdentity,
  extraIdsRaw?: string,
): PremiumSpan | null {
  if (!Number.isInteger(user.id) || user.id <= 0) return null;
  if (WEEK_ACCESS_EXEMPT_USER_IDS.includes(user.id)) return "forever";
  if (exemptUserIdsFromEnv(extraIdsRaw).includes(user.id)) return "forever";
  const username = usernameKey(user.username);
  if (!username) return null;
  return PREMIUM_WHITELIST[username] ?? null;
}

export function starPriceFromEnv(raw: string | undefined): number {
  const price = Number(raw);
  if (!Number.isInteger(price) || price < 1 || price > 10_000) return DEFAULT_STAR_PRICE;
  return price;
}

/** Extra numeric ids from `WEEK_EXEMPT_USER_IDS`, comma or space separated. */
export function exemptUserIdsFromEnv(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const ids: number[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const id = Number(part);
    if (Number.isInteger(id) && id > 0) ids.push(id);
  }
  return ids;
}

export function isWeekAccessExempt(
  user: WeekAccessIdentity,
  extraIdsRaw?: string,
): boolean {
  return whitelistSpan(user, extraIdsRaw) === "forever";
}

function grantEndMs(
  record: WeekAccessRecord,
  span: PremiumSpan | null,
): number | "forever" | null {
  if (!span) return null;
  if (span === "forever") return "forever";
  const start = record.grantFrom ? Date.parse(record.grantFrom) : NaN;
  if (!Number.isFinite(start)) return null;
  return start + PREMIUM_SPAN_DAYS[span] * DAY_MS;
}

/** Stamps `grantFrom` the first time a finite whitelist span is seen. */
export function applyWhitelistGrant(
  record: WeekAccessRecord,
  span: PremiumSpan | null,
  now: Date,
): { record: WeekAccessRecord; changed: boolean } {
  if (span !== "month" && span !== "quarter" && span !== "year") {
    return { record, changed: false };
  }
  if (record.grantFrom) return { record, changed: false };
  return { record: { ...record, grantFrom: now.toISOString() }, changed: true };
}

export function accessForUser(
  record: WeekAccessRecord,
  user: WeekAccessIdentity,
  extraIdsRaw: string | undefined,
  now: Date,
  starPrice = DEFAULT_STAR_PRICE,
): { record: WeekAccessRecord; changed: boolean; view: WeekAccessView } {
  const span = whitelistSpan(user, extraIdsRaw);
  const applied = applyWhitelistGrant(record, span, now);
  return {
    record: applied.record,
    changed: applied.changed,
    view: describeWeekAccess(applied.record, now, starPrice, {
      exempt: span === "forever",
      grant: span,
    }),
  };
}

/** Voice notes follow a paid «Неделя». The free trial does not open them. */
export function voiceNotesOpen(
  record: WeekAccessRecord,
  now: Date,
  options?: { exempt?: boolean; grant?: PremiumSpan | null },
): boolean {
  if (options?.exempt || options?.grant === "forever") return true;
  const grantEnd = grantEndMs(record, options?.grant ?? null);
  if (typeof grantEnd === "number" && grantEnd > now.getTime()) return true;
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  return Number.isFinite(paidMs) && paidMs > now.getTime();
}

/** Starts the free week the first time «Неделя» is opened. */
export function openWeekAccess(record: WeekAccessRecord, now: Date): WeekAccessRecord {
  if (record.openedAt) return record;
  return { ...record, openedAt: now.toISOString() };
}

export function markWeekIntroSeen(record: WeekAccessRecord): WeekAccessRecord {
  return { ...record, introSeen: true };
}

/** Keeps the later end date so a renewal does not shorten an existing period. */
export function grantWeekPaidUntil(
  record: WeekAccessRecord,
  paidUntil: string,
): WeekAccessRecord {
  const next = Date.parse(paidUntil);
  if (!Number.isFinite(next)) return record;
  const prev = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const until = Number.isFinite(prev) && prev > next ? record.paidUntil : new Date(next).toISOString();
  return { ...record, paidUntil: until };
}

export function describeWeekAccess(
  record: WeekAccessRecord,
  now: Date,
  starPrice = DEFAULT_STAR_PRICE,
  options?: { exempt?: boolean; grant?: PremiumSpan | null },
): WeekAccessView {
  const openedMs = record.openedAt ? Date.parse(record.openedAt) : NaN;
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const nowMs = now.getTime();
  const paid = Number.isFinite(paidMs) && paidMs > nowMs;
  const trialEndsMs = Number.isFinite(openedMs) ? openedMs + TRIAL_MS : NaN;
  const inTrial = Number.isFinite(trialEndsMs) && nowMs < trialEndsMs;
  const grantEnd = options?.exempt ? "forever" : grantEndMs(record, options?.grant ?? null);
  const grantActive =
    grantEnd === "forever" || (typeof grantEnd === "number" && grantEnd > nowMs);

  let premium: PremiumKind = "none";
  let premiumDaysLeft = 0;
  if (grantEnd === "forever") {
    premium = "forever";
  } else {
    const ends: number[] = [];
    if (typeof grantEnd === "number" && grantEnd > nowMs) ends.push(grantEnd);
    if (paid) ends.push(paidMs);
    if (ends.length) {
      premium = "timed";
      premiumDaysLeft = Math.max(1, Math.ceil((Math.max(...ends) - nowMs) / DAY_MS));
    }
  }

  let status: WeekAccessStatus = "new";
  if (grantActive || paid) status = "paid";
  else if (Number.isFinite(openedMs) && inTrial) status = "trial";
  else if (Number.isFinite(openedMs)) status = "locked";

  const daysLeft =
    status === "trial" ? Math.max(1, Math.ceil((trialEndsMs - nowMs) / DAY_MS)) : 0;

  return {
    status,
    openedAt: record.openedAt,
    paidUntil: record.paidUntil,
    trialEndsAt: Number.isFinite(trialEndsMs) ? new Date(trialEndsMs).toISOString() : null,
    introSeen: grantEnd === "forever" ? true : record.introSeen,
    daysLeft,
    premium,
    premiumDaysLeft,
    starPrice,
    prices: {
      month: planPrice(starPrice, "month"),
      quarter: planPrice(starPrice, "quarter"),
      year: planPrice(starPrice, "year"),
    },
  };
}

export function daysPhrase(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "дней";
  if (mod10 === 1 && mod100 !== 11) word = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "дня";
  return `${n} ${word}`;
}
