import { normalizeFeelings } from "./feelings";
import { sanitizeTags } from "./tags";
import {
  emptyNotify,
  emptyStore,
  type CheckinSlot,
  type EntrySource,
  type JournalEntry,
  type NotifyPrefs,
  type SessionNote,
  type SessionPlan,
  type TherapyStore,
  type WeekPrep,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function normalizeEntry(raw: unknown): JournalEntry | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  if (typeof entry.id !== "string" || !entry.id) return null;
  if (typeof entry.date !== "string" || !DATE_RE.test(entry.date)) return null;

  const tagsRaw = Array.isArray(entry.tags)
    ? entry.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const fromBot = tagsRaw.includes("бот") || entry.source === "bot";
  const source: EntrySource =
    entry.source === "checkin" ? "checkin" : fromBot ? "bot" : "app";
  const updatedAt =
    typeof entry.updatedAt === "string" && entry.updatedAt
      ? entry.updatedAt
      : new Date(0).toISOString();
  const createdAt =
    typeof entry.createdAt === "string" && entry.createdAt
      ? entry.createdAt
      : updatedAt;
  const slot: CheckinSlot | undefined =
    entry.slot === "morning" || entry.slot === "day" || entry.slot === "evening"
      ? entry.slot
      : undefined;

  const next: JournalEntry = {
    id: entry.id,
    date: entry.date,
    createdAt,
    updatedAt,
    body: typeof entry.body === "string" ? entry.body : "",
    feelings: normalizeFeelings(entry.feelings, entry.mood),
    tags: sanitizeTags(tagsRaw),
    source,
  };
  if (slot) next.slot = slot;
  return next;
}

function normalizeSession(raw: unknown): SessionNote | null {
  const session = asRecord(raw);
  if (!session) return null;
  if (typeof session.id !== "string" || !session.id) return null;
  if (typeof session.date !== "string" || !DATE_RE.test(session.date)) return null;
  if (typeof session.summary !== "string") return null;
  return {
    id: session.id,
    date: session.date,
    summary: session.summary,
    insights: typeof session.insights === "string" ? session.insights : "",
    homework: typeof session.homework === "string" ? session.homework : "",
    weekKey: typeof session.weekKey === "string" ? session.weekKey : "",
    updatedAt:
      typeof session.updatedAt === "string" ? session.updatedAt : new Date(0).toISOString(),
  };
}

function normalizeWeekPrep(raw: unknown): WeekPrep | null {
  const prep = asRecord(raw);
  if (!prep) return null;
  if (typeof prep.weekKey !== "string" || !prep.weekKey) return null;
  const next: WeekPrep = {
    weekKey: prep.weekKey,
    talkNotes: typeof prep.talkNotes === "string" ? prep.talkNotes : "",
    updatedAt:
      typeof prep.updatedAt === "string" ? prep.updatedAt : new Date(0).toISOString(),
  };
  if (typeof prep.briefText === "string" && prep.briefText && typeof prep.briefStamp === "string") {
    next.briefText = prep.briefText;
    next.briefStamp = prep.briefStamp;
  }
  return next;
}

function normalizePlan(raw: unknown): SessionPlan | null {
  const plan = asRecord(raw);
  if (!plan) return null;
  if (plan.mode !== "once" && plan.mode !== "weekly") return null;
  if (typeof plan.time !== "string" || !TIME_RE.test(plan.time)) return null;
  const weekday = typeof plan.weekday === "number" ? plan.weekday : 0;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  const date = typeof plan.date === "string" && DATE_RE.test(plan.date) ? plan.date : "";
  if (plan.mode === "once" && !date) return null;
  return {
    mode: plan.mode,
    date,
    time: plan.time,
    weekday,
    updatedAt: typeof plan.updatedAt === "string" ? plan.updatedAt : "",
  };
}

function normalizeNotify(raw: unknown): NotifyPrefs {
  const notify = asRecord(raw);
  if (!notify) return emptyNotify();
  return {
    moodPolls: typeof notify.moodPolls === "boolean" ? notify.moodPolls : true,
    eveningNudge:
      typeof notify.eveningNudge === "boolean" ? notify.eveningNudge : true,
    updatedAt: typeof notify.updatedAt === "string" ? notify.updatedAt : "",
  };
}

/** Accept v1 (mood 1–5, tag «бот») and v2 stores. Returns null when the shape is unusable. */
export function normalizeStore(value: unknown): TherapyStore | null {
  const store = asRecord(value);
  if (!store) return null;
  if (store.version !== 1 && store.version !== 2) return null;
  if (!Array.isArray(store.entries) || !Array.isArray(store.sessions) || !Array.isArray(store.weekPreps)) {
    return null;
  }

  return {
    version: 2,
    entries: store.entries
      .map(normalizeEntry)
      .filter((entry): entry is JournalEntry => Boolean(entry)),
    sessions: store.sessions
      .map(normalizeSession)
      .filter((session): session is SessionNote => Boolean(session)),
    weekPreps: store.weekPreps
      .map(normalizeWeekPrep)
      .filter((prep): prep is WeekPrep => Boolean(prep)),
    sessionPlan: normalizePlan(store.sessionPlan),
    notify: normalizeNotify(store.notify),
  };
}

export function storeChangedShape(raw: unknown, normalized: TherapyStore): boolean {
  const store = asRecord(raw);
  if (!store || store.version !== 2) return true;
  return JSON.stringify(store) !== JSON.stringify(normalized);
}

export function cloneEmptyStore(): TherapyStore {
  return emptyStore();
}
