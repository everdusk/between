export const TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_PERIOD_SEC = 2_592_000;
export const DEFAULT_STAR_PRICE = 150;
/** Rubles for 30 days of Week in the browser. Stars stay the Telegram price. */
export const DEFAULT_RUB_PRICE = 150;
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
  /** Set while a paid period is frozen. The end date does not move until resume. */
  pausedAt: string | null;
  paywallAt: string | null;
  nudge1At: string | null;
  nudge2At: string | null;
  day5At: string | null;
  sliceAt: string | null;
  renewSoonAt: string | null;
  renewLastAt: string | null;
  expiredNoticeAt: string | null;
};

export type CycleStamp =
  | "paywallAt"
  | "nudge1At"
  | "nudge2At"
  | "day5At"
  | "sliceAt"
  | "renewSoonAt"
  | "renewLastAt"
  | "expiredNoticeAt";

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
  /** Monthly price in rubles for the browser. Telegram keeps Stars. */
  rubPrice: number;
  prices: { month: number; quarter: number; year: number };
  /** Paid time is frozen. Pings and reminders stay quiet until resume. */
  paused: boolean;
};

export function emptyWeekAccess(): WeekAccessRecord {
  return {
    openedAt: null,
    paidUntil: null,
    introSeen: false,
    grantFrom: null,
    pausedAt: null,
    paywallAt: null,
    nudge1At: null,
    nudge2At: null,
    day5At: null,
    sliceAt: null,
    renewSoonAt: null,
    renewLastAt: null,
    expiredNoticeAt: null,
  };
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
    pausedAt: isoOrNull(record.pausedAt),
    paywallAt: isoOrNull(record.paywallAt),
    nudge1At: isoOrNull(record.nudge1At),
    nudge2At: isoOrNull(record.nudge2At),
    day5At: isoOrNull(record.day5At),
    sliceAt: isoOrNull(record.sliceAt),
    renewSoonAt: isoOrNull(record.renewSoonAt),
    renewLastAt: isoOrNull(record.renewLastAt),
    expiredNoticeAt: isoOrNull(record.expiredNoticeAt),
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

/** A Stars receipt matches the invoice we created for this plan. */
export function starsChargeAccepted(
  plan: PremiumPlan,
  currency: string | undefined,
  totalAmount: number | undefined,
  monthly: number,
): boolean {
  return currency === "XTR" && totalAmount === planPrice(monthly, plan);
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

function priceFromEnv(raw: string | undefined, fallback: number): number {
  const price = Number(raw);
  if (!Number.isInteger(price) || price < 1 || price > 10_000) return fallback;
  return price;
}

export function starPriceFromEnv(raw: string | undefined): number {
  return priceFromEnv(raw, DEFAULT_STAR_PRICE);
}

export function rubPriceFromEnv(raw: string | undefined): number {
  return priceFromEnv(raw, DEFAULT_RUB_PRICE);
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
  rubPrice = DEFAULT_RUB_PRICE,
): { record: WeekAccessRecord; changed: boolean; view: WeekAccessView } {
  const span = whitelistSpan(user, extraIdsRaw);
  const applied = applyWhitelistGrant(record, span, now);
  return {
    record: applied.record,
    changed: applied.changed,
    view: describeWeekAccess(applied.record, now, starPrice, {
      exempt: span === "forever",
      grant: span,
      rubPrice,
    }),
  };
}

function paidClock(record: WeekAccessRecord, nowMs: number): number {
  const pausedMs = record.pausedAt ? Date.parse(record.pausedAt) : NaN;
  return Number.isFinite(pausedMs) ? pausedMs : nowMs;
}

function paidActive(record: WeekAccessRecord, nowMs: number): boolean {
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  return Number.isFinite(paidMs) && paidMs > paidClock(record, nowMs);
}

/** Voice notes are open during the trial and while the week is paid. */
export function voiceNotesOpen(
  record: WeekAccessRecord,
  now: Date,
  options?: { exempt?: boolean; grant?: PremiumSpan | null },
): boolean {
  if (options?.exempt || options?.grant === "forever") return true;
  const grantEnd = grantEndMs(record, options?.grant ?? null);
  if (typeof grantEnd === "number" && grantEnd > now.getTime()) return true;
  if (paidActive(record, now.getTime())) return true;
  const openedMs = record.openedAt ? Date.parse(record.openedAt) : NaN;
  return Number.isFinite(openedMs) && now.getTime() < openedMs + TRIAL_MS;
}

/** New notes and check-ins. A locked week keeps the old ones and accepts no more. */
export function entriesOpen(status: WeekAccessStatus): boolean {
  return status !== "locked";
}

/** Freezes a paid period. Trial and a locked week have no pause. */
export function pauseWeek(record: WeekAccessRecord, now: Date): WeekAccessRecord | null {
  if (record.pausedAt) return record;
  if (!paidActive(record, now.getTime())) return null;
  return { ...record, pausedAt: now.toISOString() };
}

/** Adds the frozen days back onto the end date. */
export function resumeWeek(record: WeekAccessRecord, now: Date): WeekAccessRecord {
  const pausedMs = record.pausedAt ? Date.parse(record.pausedAt) : NaN;
  if (!Number.isFinite(pausedMs)) return { ...record, pausedAt: null };
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const remaining = Number.isFinite(paidMs) ? Math.max(0, paidMs - pausedMs) : 0;
  return {
    ...record,
    pausedAt: null,
    paidUntil: new Date(now.getTime() + remaining).toISOString(),
  };
}

/** Adds a purchased period to whatever paid time is still ahead. */
export function grantStackedPlan(
  record: WeekAccessRecord,
  plan: PremiumPlan,
  now: Date,
  subscriptionExpirationSec?: number,
): WeekAccessRecord {
  const added = planDays(plan) * DAY_MS;
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const paused = Number.isFinite(record.pausedAt ? Date.parse(record.pausedAt) : NaN);
  const anchor = paused
    ? Number.isFinite(paidMs)
      ? paidMs
      : now.getTime()
    : Number.isFinite(paidMs) && paidMs > now.getTime()
      ? paidMs
      : now.getTime();
  let until = anchor + added;
  if (plan === "month" && typeof subscriptionExpirationSec === "number" && subscriptionExpirationSec > 0) {
    until = Math.max(until, subscriptionExpirationSec * 1000);
  }
  return { ...record, paidUntil: new Date(until).toISOString() };
}

export function stampCycle(record: WeekAccessRecord, field: CycleStamp, now: Date): WeekAccessRecord {
  if (record[field]) return record;
  return { ...record, [field]: now.toISOString() };
}

/** Starts the free week at the first /start. Opening «Неделя» does not. */
export function openWeekAccess(record: WeekAccessRecord, now: Date): WeekAccessRecord {
  if (record.openedAt) return record;
  return { ...record, openedAt: now.toISOString() };
}

export function markWeekIntroSeen(record: WeekAccessRecord): WeekAccessRecord {
  return { ...record, introSeen: true };
}

function earlierIso(left: string | null, right: string | null): string | null {
  const a = left ? Date.parse(left) : NaN;
  const b = right ? Date.parse(right) : NaN;
  if (!Number.isFinite(a)) return Number.isFinite(b) ? new Date(b).toISOString() : null;
  if (!Number.isFinite(b)) return new Date(a).toISOString();
  return new Date(Math.min(a, b)).toISOString();
}

function laterIso(left: string | null, right: string | null): string | null {
  const a = left ? Date.parse(left) : NaN;
  const b = right ? Date.parse(right) : NaN;
  if (!Number.isFinite(a)) return Number.isFinite(b) ? new Date(b).toISOString() : null;
  if (!Number.isFinite(b)) return new Date(a).toISOString();
  return new Date(Math.max(a, b)).toISOString();
}

function remainingPaidMs(record: WeekAccessRecord, nowMs: number): number {
  const paid = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  if (!Number.isFinite(paid)) return 0;
  return Math.max(0, paid - paidClock(record, nowMs));
}

function earlierStamp(left: WeekAccessRecord, right: WeekAccessRecord, field: CycleStamp): string | null {
  return earlierIso(left[field], right[field]);
}

/**
 * One premium after a browser account and a Telegram account become the same journal.
 * Trial start stays the earlier one. Two paid periods are added together.
 */
export function mergeWeekAccess(
  left: WeekAccessRecord,
  right: WeekAccessRecord,
  now: Date,
): WeekAccessRecord {
  const nowMs = now.getTime();
  const leftMs = remainingPaidMs(left, nowMs);
  const rightMs = remainingPaidMs(right, nowMs);
  let paidUntil: string | null;
  let pausedAt: string | null = null;
  if (leftMs > 0 && rightMs > 0) paidUntil = new Date(nowMs + leftMs + rightMs).toISOString();
  else if (leftMs > 0) {
    paidUntil = new Date(Date.parse(left.paidUntil ?? "")).toISOString();
    pausedAt = left.pausedAt;
  } else if (rightMs > 0) {
    paidUntil = new Date(Date.parse(right.paidUntil ?? "")).toISOString();
    pausedAt = right.pausedAt;
  } else paidUntil = laterIso(left.paidUntil, right.paidUntil);
  return {
    openedAt: earlierIso(left.openedAt, right.openedAt),
    paidUntil,
    introSeen: left.introSeen || right.introSeen,
    grantFrom: earlierIso(left.grantFrom, right.grantFrom),
    pausedAt,
    paywallAt: earlierStamp(left, right, "paywallAt"),
    nudge1At: earlierStamp(left, right, "nudge1At"),
    nudge2At: earlierStamp(left, right, "nudge2At"),
    day5At: earlierStamp(left, right, "day5At"),
    sliceAt: earlierStamp(left, right, "sliceAt"),
    renewSoonAt: earlierStamp(left, right, "renewSoonAt"),
    renewLastAt: earlierStamp(left, right, "renewLastAt"),
    expiredNoticeAt: earlierStamp(left, right, "expiredNoticeAt"),
  };
}

/**
 * Fold a Telegram premium into the shared journal once.
 * The Telegram copy loses its paid end, so a second link does not add those days again.
 */
export function absorbWeekPremium(
  web: WeekAccessRecord,
  telegram: WeekAccessRecord,
  now: Date,
): { web: WeekAccessRecord; telegram: WeekAccessRecord } {
  const merged = mergeWeekAccess(web, telegram, now);
  const contributed = remainingPaidMs(telegram, now.getTime()) > 0;
  return {
    web: merged,
    telegram: contributed ? { ...telegram, paidUntil: null } : telegram,
  };
}

/** Keeps an earlier trial from this browser. A client cannot grant itself premium. */
export function adoptClientTrial(
  server: WeekAccessRecord,
  client: WeekAccessRecord,
  now: Date,
): WeekAccessRecord {
  const nowMs = now.getTime();
  const clientOpen = client.openedAt ? Date.parse(client.openedAt) : NaN;
  const serverOpen = server.openedAt ? Date.parse(server.openedAt) : NaN;
  let openedAt = server.openedAt;
  if (Number.isFinite(clientOpen) && clientOpen <= nowMs) {
    if (!Number.isFinite(serverOpen) || clientOpen < serverOpen) {
      openedAt = new Date(clientOpen).toISOString();
    }
  }
  return {
    ...server,
    openedAt,
    introSeen: server.introSeen || client.introSeen === true,
  };
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
  options?: { exempt?: boolean; grant?: PremiumSpan | null; rubPrice?: number },
): WeekAccessView {
  const openedMs = record.openedAt ? Date.parse(record.openedAt) : NaN;
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const nowMs = now.getTime();
  const paused = Number.isFinite(record.pausedAt ? Date.parse(record.pausedAt) : NaN);
  const clock = paidClock(record, nowMs);
  const paid = Number.isFinite(paidMs) && paidMs > clock;
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
      premiumDaysLeft = Math.max(1, Math.ceil((Math.max(...ends) - clock) / DAY_MS));
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
    rubPrice: options?.rubPrice ?? DEFAULT_RUB_PRICE,
    prices: {
      month: planPrice(starPrice, "month"),
      quarter: planPrice(starPrice, "quarter"),
      year: planPrice(starPrice, "year"),
    },
    paused: paused && paid,
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
