/** Funnel, in order. `paid` is a confirmed Stars or SBP charge, never a page view. */
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
/** /stats starts here. Earlier Moscow days stay in Redis and stay out of the report. */
export const STATS_VISIBLE_FROM = "2026-11-13";

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

/** One action on the checkout. The receipt address and the bank link never travel with it. */
export const SUBSCRIBE_STEPS = [
  "signed_out",
  "open",
  "plan",
  "email",
  "email_bad",
  "pay",
  "pay_fail",
  "qr",
  "bank",
  "paid",
  "pending",
  "close",
  "cancel",
  "journal",
  "terms",
  "privacy",
] as const;

export const SUBSCRIBE_FAILS = ["auth", "not_configured", "bad_payment", "network", "rejected"] as const;

export type SubscribeStep = (typeof SUBSCRIBE_STEPS)[number];
export type SubscribeFail = (typeof SUBSCRIBE_FAILS)[number];

/** `web_subscribe` and the same for Telegram and MAX. Not a daily funnel counter. */
export function subscribeEventName(messenger: AnalyticsMessenger): string {
  return `${messenger}_subscribe`;
}

export function parseSubscribeEvent(name: string): AnalyticsMessenger | null {
  const match = /^(telegram|max|web)_subscribe$/.exec(name);
  return match ? (match[1] as AnalyticsMessenger) : null;
}

/** Telegram launch data wins. A MAX launch is not the website. */
export function clientMessenger(
  telegramInitData: string,
  maxInitData: string | null | undefined,
): AnalyticsMessenger {
  if (telegramInitData.trim()) return "telegram";
  if (maxInitData?.trim()) return "max";
  return "web";
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

/** MAX id of the account that reads /stats. A Telegram id is not in this list. */
const ANALYTICS_QUIET_MAX_IDS: readonly number[] = [1062664437];

/**
 * The people who read /stats. Their own steps stay out of the counters and PostHog.
 * The username list defaults to the stats owner. The MAX id is matched only as MAX.
 */
export function analyticsQuiet(input: {
  username?: string | null;
  userId?: number | string | null;
  messenger?: AnalyticsMessenger | null;
  owners?: string | null;
}): boolean {
  const owners = input.owners?.trim() || "aliatorovskaia";
  if (isAnalyticsOwner(input.username ?? undefined, owners)) return true;
  if (input.messenger !== "max") return false;
  const raw = input.userId;
  const id = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(id) && ANALYTICS_QUIET_MAX_IDS.includes(id);
}

/** User object inside a Telegram or MAX launch string. The signature is not checked. */
export function launchUser(initData: string | null | undefined): { id?: number; username?: string } | null {
  if (!initData) return null;
  let raw: string | null;
  try {
    raw = new URLSearchParams(initData).get("user");
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: { id?: unknown; username?: unknown };
  try {
    parsed = JSON.parse(raw) as { id?: unknown; username?: unknown };
  } catch {
    return null;
  }
  const id =
    typeof parsed.id === "number"
      ? parsed.id
      : typeof parsed.id === "string" && /^\d+$/.test(parsed.id)
        ? Number(parsed.id)
        : undefined;
  const username = typeof parsed.username === "string" ? parsed.username : undefined;
  if (id == null && !username) return null;
  return { id, username };
}

/** True when this browser launch is the stats owner in Telegram or MAX. */
export function quietClientLaunch(input: { telegramInit?: string | null; maxInit?: string | null }): boolean {
  const telegram = launchUser(input.telegramInit);
  const max = launchUser(input.maxInit);
  if (telegram && analyticsQuiet({ username: telegram.username, messenger: "telegram" })) return true;
  if (max && analyticsQuiet({ username: max.username, userId: max.id, messenger: "max" })) return true;
  return false;
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

/** Days inside the report span that are on or after the clean start. */
export function statsWindow(today: string, span: number): string[] {
  const days: string[] = [];
  for (let ago = span - 1; ago >= 0; ago -= 1) {
    const day = shiftDay(today, -ago);
    if (day && day >= STATS_VISIBLE_FROM) days.push(day);
  }
  return days;
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
  const subscribe = parseSubscribeEvent(event.event);
  if (!named && !subscribe && !(ANALYTICS_EVENTS as readonly string[]).includes(event.event)) return null;
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
    if (key === "step") {
      if ((SUBSCRIBE_STEPS as readonly string[]).includes(String(value))) properties.step = String(value);
      continue;
    }
    if (key === "fail") {
      if (source.step === "pay_fail" && (SUBSCRIBE_FAILS as readonly string[]).includes(String(value))) {
        properties.fail = String(value);
      }
      continue;
    }
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
  if (subscribe) properties.messenger = subscribe;
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

const MESSENGER_TITLE: Record<Exclude<AnalyticsMessenger, "web">, string> = {
  telegram: "Telegram",
  max: "MAX",
};

const STATS_MESSENGERS = ["telegram", "max"] as const;

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
  const any = STATS_MESSENGERS.some(
    (messenger) =>
      ANALYTICS_EVENTS.some((event) => report.messengers[messenger].totals[event] > 0) ||
      report.messengers[messenger].cohorts.length > 0,
  );
  if (!any) return "Пока никто не открывал Between.";

  const lines = [`Between за ${report.windowDays} дн., по Москве`, ""];
  for (const messenger of STATS_MESSENGERS) {
    lines.push(...formatMessengerBlock(MESSENGER_TITLE[messenger], report.messengers[messenger]));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
