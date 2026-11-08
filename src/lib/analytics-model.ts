/** Funnel, in order. `paid` is recorded only from a confirmed Stars payment. */
export const ANALYTICS_EVENTS = ["visit", "note", "mood", "block", "plan", "week", "paywall", "checkout", "paid"] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const CLIENT_ANALYTICS_EVENTS = ["visit", "note", "week", "paywall", "checkout"] as const;
export type ClientAnalyticsEvent = (typeof CLIENT_ANALYTICS_EVENTS)[number];

/** The only custom properties a product event may carry. */
export const PRODUCT_PLANS = ["month", "quarter", "year"] as const;
export type ProductPlan = (typeof PRODUCT_PLANS)[number];

/** Where the step happened. The website is its own stream, not Telegram and not MAX. */
export const ANALYTICS_MESSENGERS = ["telegram", "max", "web"] as const;
export type AnalyticsMessenger = (typeof ANALYTICS_MESSENGERS)[number];

const DROPPED_PRODUCT_KEYS = new Set(["$set", "$set_once", "$unset", "$ip"]);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OFFSET = 400;
const REPORT_DAYS = 7;
const COHORT_DAYS = 14;

const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const LABELS: Record<AnalyticsEvent, string> = {
  visit: "Визит",
  note: "Заметка",
  mood: "Настроение",
  block: "Блокировка",
  plan: "График",
  week: "Неделя",
  paywall: "Пейволл",
  checkout: "Счёт",
  paid: "Оплата",
};

export type MessengerReport = {
  todayCounts: Record<AnalyticsEvent, number>;
  totals: Record<AnalyticsEvent, number>;
  cohorts: { day: string; size: number; week: number | null }[];
};

export type AnalyticsSnapshot = {
  today: string;
  windowDays: number;
  messengers: Record<AnalyticsMessenger, MessengerReport>;
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

/** Legacy key, from before counters were split. New writes use `messenger`. */
export function analyticsCounterKey(
  day: string,
  event: AnalyticsEvent,
  messenger?: AnalyticsMessenger,
): string {
  if (messenger) return `between:analytics:day:${day}:${messenger}:${event}`;
  return `between:analytics:day:${day}:${event}`;
}

/** A return on any of the seven days after the first visit. Not the next day, and not day 7 alone. */
export const WEEK_RETURN_OFFSET = 8;

export function analyticsCohortKey(
  cohort: string,
  offset: number,
  messenger?: AnalyticsMessenger,
): string {
  if (messenger) return `between:analytics:cohort:${messenger}:${cohort}:d${offset}`;
  return `between:analytics:cohort:${cohort}:d${offset}`;
}

/** PostHog event name. `note` becomes `telegram_note` or `max_note`. */
export function messengerEventName(messenger: AnalyticsMessenger, event: AnalyticsEvent): string {
  return `${messenger}_${event}`;
}

export function parseMessengerEvent(
  name: string,
): { messenger: AnalyticsMessenger; event: AnalyticsEvent } | null {
  const match = /^(telegram|max|web)_(visit|note|mood|block|plan|week|paywall|checkout|paid)$/.exec(name);
  if (!match) return null;
  const messenger = match[1] as AnalyticsMessenger;
  const event = match[2] as AnalyticsEvent;
  return { messenger, event };
}

export function analyticsDedupKey(day: string): string {
  return `between:analytics:dedup:${day}`;
}

export function emptyAnalyticsCounts(): Record<AnalyticsEvent, number> {
  return { visit: 0, note: 0, mood: 0, block: 0, plan: 0, week: 0, paywall: 0, checkout: 0, paid: 0 };
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

export function sumCountRows(
  left: { day: string; counts: Record<AnalyticsEvent, number> }[],
  right: { day: string; counts: Record<AnalyticsEvent, number> }[],
): { day: string; counts: Record<AnalyticsEvent, number> }[] {
  return left.map((row, index) => {
    const extra = right[index]?.counts ?? emptyAnalyticsCounts();
    const counts = emptyAnalyticsCounts();
    for (const event of ANALYTICS_EVENTS) counts[event] = row.counts[event] + (extra[event] ?? 0);
    return { day: row.day, counts };
  });
}

export function snapshotFromReads(
  today: string,
  dayCounts: { day: string; counts: Record<AnalyticsEvent, number> }[],
  cohorts: { day: string; d0: number; week: number }[],
): MessengerReport & { today: string; windowDays: number } {
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
          week: age >= 1 ? row.week : null,
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
  return (
    key.startsWith("$") ||
    key === "distinct_id" ||
    key === "token" ||
    key === "plan" ||
    key === "messenger"
  );
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
  const named = parseMessengerEvent(event.event);
  if (!named && !(ANALYTICS_EVENTS as readonly string[]).includes(event.event)) return null;
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
    if (key === "messenger") {
      if ((ANALYTICS_MESSENGERS as readonly string[]).includes(String(value))) {
        properties.messenger = String(value);
      }
      continue;
    }
    const quiet = quietProductValue(value);
    if (quiet !== undefined) properties[key] = quiet;
  }
  if (named) properties.messenger = named.messenger;
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

const MESSENGER_TITLE: Record<AnalyticsMessenger, string> = {
  telegram: "Telegram",
  max: "MAX",
  web: "Сайт",
};

function formatMessengerBlock(title: string, part: MessengerReport): string[] {
  const lines = [title];
  for (const event of ANALYTICS_EVENTS) {
    lines.push(`${LABELS[event]} ${part.totals[event]}`);
  }
  lines.push(
    `Сегодня: визит ${part.todayCounts.visit}, пейволл ${part.todayCounts.paywall}, оплата ${part.todayCounts.paid}`,
  );
  if (part.cohorts.length) {
    lines.push("Возвраты");
    for (const row of [...part.cohorts].reverse()) {
      const back =
        row.week == null ? "за неделю ещё нет" : `за неделю ${row.week} из ${row.size}`;
      lines.push(`${ruDay(row.day)} — ${row.size} новых, ${back}`);
    }
  }
  return lines;
}

export function formatAnalyticsReport(report: AnalyticsSnapshot): string {
  const any = ANALYTICS_MESSENGERS.some(
    (messenger) =>
      ANALYTICS_EVENTS.some((event) => report.messengers[messenger].totals[event] > 0) ||
      report.messengers[messenger].cohorts.length > 0,
  );
  if (!any) return "Пока никто не открывал Between.";

  const lines = [`Between за ${report.windowDays} дн., по Москве`, ""];
  for (const messenger of ANALYTICS_MESSENGERS) {
    lines.push(...formatMessengerBlock(MESSENGER_TITLE[messenger], report.messengers[messenger]));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
