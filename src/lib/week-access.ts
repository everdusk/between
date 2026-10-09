export const TRIAL_MS = 14 * 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_PERIOD_SEC = 2_592_000;
export const DEFAULT_STAR_PRICE = 150;
export const WEEK_INVOICE_PAYLOAD = "between-week";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekAccessRecord = {
  openedAt: string | null;
  paidUntil: string | null;
  introSeen: boolean;
};

export type WeekAccessStatus = "new" | "trial" | "paid" | "locked";

export type WeekAccessView = {
  status: WeekAccessStatus;
  openedAt: string | null;
  paidUntil: string | null;
  trialEndsAt: string | null;
  introSeen: boolean;
  daysLeft: number;
  starPrice: number;
};

export function emptyWeekAccess(): WeekAccessRecord {
  return { openedAt: null, paidUntil: null, introSeen: false };
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
  };
}

export function starPriceFromEnv(raw: string | undefined): number {
  const price = Number(raw);
  if (!Number.isInteger(price) || price < 1 || price > 10_000) return DEFAULT_STAR_PRICE;
  return price;
}

/** Starts the free fortnight the first time «Неделя» is opened. */
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
): WeekAccessView {
  const openedMs = record.openedAt ? Date.parse(record.openedAt) : NaN;
  const paidMs = record.paidUntil ? Date.parse(record.paidUntil) : NaN;
  const nowMs = now.getTime();
  const paid = Number.isFinite(paidMs) && paidMs > nowMs;
  const trialEndsMs = Number.isFinite(openedMs) ? openedMs + TRIAL_MS : NaN;
  const inTrial = Number.isFinite(trialEndsMs) && nowMs < trialEndsMs;

  let status: WeekAccessStatus = "new";
  if (paid) status = "paid";
  else if (Number.isFinite(openedMs) && inTrial) status = "trial";
  else if (Number.isFinite(openedMs)) status = "locked";

  const daysLeft =
    status === "trial" ? Math.max(1, Math.ceil((trialEndsMs - nowMs) / DAY_MS)) : 0;

  return {
    status,
    openedAt: record.openedAt,
    paidUntil: record.paidUntil,
    trialEndsAt: Number.isFinite(trialEndsMs) ? new Date(trialEndsMs).toISOString() : null,
    introSeen: record.introSeen,
    daysLeft,
    starPrice,
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
