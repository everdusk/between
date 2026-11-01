/** Funnel, in order. `paid` is recorded only from a confirmed Stars payment. */
export const ANALYTICS_EVENTS = ["visit", "note", "week", "paywall", "checkout", "paid"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const CLIENT_ANALYTICS_EVENTS = ["visit", "note", "week", "paywall", "checkout"] as const;
export type ClientAnalyticsEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number];

/** The only custom property a product event may carry. */
export const PRODUCT_PLANS = ["month", "quarter", "year"] as const;
export type ProductPlan = (typeof PRODUCT_PLANS)[number];

const DROPPED_PRODUCT_KEYS = new Set(["$set", "$set_once", "$unset", "$ip"]);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OFFSET = 400;
const REPORT_DAYS = 7;
const COHORT_DAYS = 14;

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const LABELS: Record<AnalyticsEvent, string> = {
  visit: "Визит",
  note: "Заметка",
  week: "Неделя",
  paywall: "Пейволл",
  checkout: "Счёт",
  paid: "Оплата",
};

export type AnalyticsSnapshot = {
  today: string;
  windowDays: number;
  todayCounts: Record<AnalyticsEvent, number>;
  totals: Record<AnalyticsEvent, number>;
  cohorts: { day: string; size: number; d1: number | null; d7: number | null }[];
};

/** Calendar day index for a real YYYY-MM-DD, or null. */
export function dayNumber(iso: string): number | null {
  if (!DAY_RE.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(utc / 86_400_000);
}

/** Days from `from` to `to`. Negative when `to` is earlier. */
export function dayOffset(from: string, to: string): number | null {
  const start = dayNumber(from);
  const end = dayNumber(to);
  if (start == null || end == null) return null;
  return end - start;
}

export function shiftDay(iso: string, delta: number): string | null {
  const number = dayNumber(iso);
  if (number == null) return null;
  const date = new Date((number + delta) * 86_400_000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function analyticsCounterKey(day: string, event: AnalyticsEvent): string {
  return `between:analytics:day:${day}:${event}`;
}

export function analyticsCohortKey(cohort: string, offset: number): string {
  return `between:analytics:cohort:${cohort}:d${offset}`;
}

export function analyticsDedupKey(day: string): string {
  return `between:analytics:dedup:${day}`;
}

export function emptyAnalyticsCounts(): Record<AnalyticsEvent, number> {
  return { visit: 0, note: 0, week: 0, paywall: 0, checkout: 0, paid: 0 };
}

export function analyticsCount(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
}

type ClientState = { cohort: string | null; sent: Record<string, string[]> };

export function planAnalyticsSend(
  state: ClientState,
  event: ClientAnalyticsEvent,
  today: string,
): {
  send: boolean;
  cohort: string;
  day: string;
  state: { cohort: string; sent: Record<string, ClientAnalyticsEvent[]> };
} {
  const age = state.cohort ? dayOffset(state.cohort, today) : null;
  const cohort = age != null && age >= 0 && age <= MAX_OFFSET ? state.cohort! : today;
  const sent: Record<string, ClientAnalyticsEvent[]> = {};
  for (const [day, events] of Object.entries(state.sent ?? {})) {
    const offset = dayOffset(day, today);
    if (offset == null || offset < 0 || offset > 3 || !Array.isArray(events)) continue;
    const kept = events.filter((item): item is ClientAnalyticsEvent =>
      (CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(item),
    );
    if (kept.length) sent[day] = kept;
  }
  const todaySent = sent[today] ?? [];
  if (todaySent.includes(event)) {
    return { send: false, cohort, day: today, state: { cohort, sent } };
  }
  sent[today] = [...todaySent, event];
  return { send: true, cohort, day: today, state: { cohort, sent } };
}

export function acceptClientEvent(
  input: { event?: unknown; cohort?: unknown; day?: unknown },
  moscowToday: string,
):
  | { ok: true; event: ClientAnalyticsEvent; day: string; cohort: string; offset: number }
  | { ok: false; error: string } {
  if (!(CLIENT_ANALYTICS_EVENTS as readonly string[]).includes(String(input.event))) {
    return { ok: false, error: "bad_event" };
  }
  if (typeof input.day !== "string" || typeof input.cohort !== "string") {
    return { ok: false, error: "bad_day" };
  }
  const skew = dayOffset(moscowToday, input.day);
  if (skew == null || skew < -1 || skew > 1) return { ok: false, error: "bad_day" };
  const offset = dayOffset(input.cohort, input.day);
  if (offset == null || offset < 0 || offset > MAX_OFFSET) return { ok: false, error: "bad_cohort" };
  return { ok: true, event: input.event as ClientAnalyticsEvent, day: input.day, cohort: input.cohort, offset };
}

export function isAnalyticsOwner(username: string | undefined, owners: string): boolean {
  if (!username) return false;
  const name = username.trim().replace(/^@/, "").toLowerCase();
  if (!name) return false;
  return owners
    .split(",")
    .map((item) => item.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean)
    .includes(name);
}

export function snapshotFromReads(
  today: string,
  dayCounts: { day: string; counts: Record<AnalyticsEvent, number> }[],
  cohorts: { day: string; d0: number; d1: number; d7: number }[],
): AnalyticsSnapshot {
  const totals = emptyAnalyticsCounts();
  const todayCounts = emptyAnalyticsCounts();
  for (const row of dayCounts) {
    for (const event of ANALYTICS_EVENTS) {
      totals[event] += row.counts[event];
      if (row.day === today) todayCounts[event] = row.counts[event];
    }
  }
  return {
    today,
    windowDays: dayCounts.length,
    todayCounts,
    totals,
    cohorts: cohorts
      .filter((row) => row.d0 > 0)
      .map((row) => {
        const age = dayOffset(row.day, today) ?? 0;
        return {
          day: row.day,
          size: row.d0,
          d1: age >= 1 ? row.d1 : null,
          d7: age >= 7 ? row.d7 : null,
        };
      }),
  };
}

export function reportDaySpan(): { reportDays: number; cohortDays: number } {
  return { reportDays: REPORT_DAYS, cohortDays: COHORT_DAYS };
}

export type ProductEvent = {
  event: string;
  properties?: Record<string, unknown> | null;
  $set?: unknown;
  $set_once?: unknown;
  $unset?: unknown;
};

function keepProductKey(key: string): boolean {
  if (DROPPED_PRODUCT_KEYS.has(key)) return false;
  if (/user.?id|username|init.?data|tgWebApp/i.test(key)) return false;
  return key.startsWith("$") || key === "distinct_id" || key === "token" || key === "plan";
}

/** Origin and path only, so a Telegram launch hash never leaves the device. */
function quietProductValue(value: unknown): unknown {
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (typeof value !== "string") return undefined;
  if (/^\d{6,}$/.test(value)) return undefined;
  if (!/tgWebAppData|initData|^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

/**
 * Keeps a funnel event and the anonymous device id.
 * Drops person profiles, IP, note text, and anything that is not `plan`.
 */
export function scrubProductEvent(event: ProductEvent): (ProductEvent & { properties: Record<string, unknown> }) | null {
  if (!(ANALYTICS_EVENTS as readonly string[]).includes(event.event)) return null;
  const source =
    event.properties && typeof event.properties === "object" && !Array.isArray(event.properties)
      ? event.properties
      : {};
  const distinctId = source.distinct_id;
  if (typeof distinctId === "number" || (typeof distinctId === "string" && /^\d{5,}$/.test(distinctId))) {
    return null;
  }
  const properties: Record<string, unknown> = { $geoip_disable: true };
  for (const [key, value] of Object.entries(source)) {
    if (!keepProductKey(key)) continue;
    if (key === "plan") {
      if ((PRODUCT_PLANS as readonly string[]).includes(String(value))) properties.plan = String(value);
      continue;
    }
    const quiet = quietProductValue(value);
    if (quiet !== undefined) properties[key] = quiet;
  }
  const next = { ...event, properties };
  delete next.$set;
  delete next.$set_once;
  delete next.$unset;
  return next;
}

function ruDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ""}`.trim();
}

export function formatAnalyticsReport(report: AnalyticsSnapshot): string {
  const any = ANALYTICS_EVENTS.some((event) => report.totals[event] > 0) || report.cohorts.length > 0;
  if (!any) return "Пока никто не открывал Between.";

  const lines = [`Between за ${report.windowDays} дн., по Москве`, ""];
  for (const event of ANALYTICS_EVENTS) {
    lines.push(`${LABELS[event]} ${report.totals[event]}`);
  }
  lines.push(
    "",
    `Сегодня: визит ${report.todayCounts.visit}, пейволл ${report.todayCounts.paywall}, оплата ${report.todayCounts.paid}`,
  );
  if (report.cohorts.length) {
    lines.push("", "Возвраты");
    for (const row of [...report.cohorts].reverse()) {
      const next =
        row.d1 == null ? "следующий день ещё нет" : `следующий день ${row.d1} из ${row.size}`;
      let line = `${ruDay(row.day)} — ${row.size} новых, ${next}`;
      if (row.d7 != null) line += `, день 7: ${row.d7} из ${row.size}`;
      lines.push(line);
    }
  }
  return lines.join("\n");
}
