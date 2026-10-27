import { backlogId, USER_BACKLOG_CAP } from "./brief";
import { isFeeling, normalizeFeelings } from "./feelings";
import { sanitizeTags } from "./tags";
import {
  emptyNotify,
  emptyStore,
  type BacklogItem,
  type BacklogPriority,
  type BacklogSource,
  type SessionTheme,
  type ThemeLink,
  type ThemeQuote,
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
  const autoThemes = tagList(entry.autoThemes);
  const userTags = tagList(entry.userTags);
  const themeHidden = tagList(entry.themeHidden);
  if (autoThemes) next.autoThemes = autoThemes;
  if (userTags) next.userTags = userTags;
  if (themeHidden && themeHidden.length > 0) next.themeHidden = themeHidden;
  return next;
}

function tagList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return sanitizeTags(raw.filter((tag): tag is string => typeof tag === "string"));
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
  if (typeof prep.patternText === "string" && prep.patternText && typeof prep.patternStamp === "string") {
    next.patternText = prep.patternText;
    next.patternStamp = prep.patternStamp;
  }
  const backlog = normalizeBacklog(prep);
  if (backlog) {
    next.backlog = backlog.backlog;
    next.backlogStamp = backlog.backlogStamp;
    next.backlogSource = backlog.backlogSource;
  }
  const hidden = normalizeHidden(prep.backlogHidden);
  if (hidden) next.backlogHidden = hidden;
  if (
    (prep.themeSource === "model" || prep.themeSource === "rules") &&
    typeof prep.themeStamp === "string" &&
    prep.themeStamp
  ) {
    next.themeStamp = prep.themeStamp;
    next.themeSource = prep.themeSource;
  }
  return next;
}

function normalizeHidden(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const hidden: string[] = [];
  for (const row of raw) {
    if (typeof row !== "string") continue;
    const text = row.replace(/\s+/g, " ").trim();
    if (!text || hidden.includes(text)) continue;
    hidden.push(text.slice(0, 120));
    if (hidden.length >= 30) break;
  }
  return hidden.length > 0 ? hidden : undefined;
}

function isBacklogPriority(value: unknown): value is BacklogPriority {
  return value === "high" || value === "mid" || value === "low";
}

function normalizeBacklog(
  prep: Record<string, unknown>,
): Pick<WeekPrep, "backlog" | "backlogStamp" | "backlogSource"> | null {
  if (typeof prep.backlogStamp !== "string" || !prep.backlogStamp) return null;
  if (!Array.isArray(prep.backlog)) return null;
  const userOwned = prep.backlogSource === "user";
  const items: BacklogItem[] = [];
  for (const row of prep.backlog) {
    if (items.length >= USER_BACKLOG_CAP) break;
    const item = asRecord(row);
    if (!item || typeof item.text !== "string" || !isBacklogPriority(item.priority)) continue;
    const text = item.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const id = typeof item.id === "string" && item.id ? item.id : backlogId(text);
    const next: BacklogItem = {
      id,
      text: text.slice(0, 120),
      priority: item.priority,
      done: item.done === true,
    };
    if (item.origin === "user" || item.origin === "auto") next.origin = item.origin;
    items.push(next);
  }
  if (userOwned) {
    return {
      backlog: items,
      backlogStamp: prep.backlogStamp,
      backlogSource: "user",
    };
  }
  if (items.length === 0) {
    if (prep.backlogSource !== "model") return null;
    return {
      backlog: [],
      backlogStamp: prep.backlogStamp,
      backlogSource: "model",
    };
  }
  const backlogSource: BacklogSource = prep.backlogSource === "model" ? "model" : "rules";
  return {
    backlog: items,
    backlogStamp: prep.backlogStamp,
    backlogSource,
  };
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

function normalizeQuote(raw: unknown): ThemeQuote | null {
  const quote = asRecord(raw);
  if (!quote) return null;
  if (typeof quote.entryId !== "string" || !quote.entryId) return null;
  if (typeof quote.text !== "string" || !quote.text.trim()) return null;
  if (typeof quote.date !== "string" || !DATE_RE.test(quote.date)) return null;
  const intensity = typeof quote.intensity === "number" ? quote.intensity : 1;
  return {
    entryId: quote.entryId,
    text: quote.text.replace(/\s+/g, " ").trim().slice(0, 140),
    date: quote.date,
    intensity: Math.min(10, Math.max(1, Math.round(intensity))),
  };
}

function normalizeTheme(raw: unknown): SessionTheme | null {
  const theme = asRecord(raw);
  if (!theme) return null;
  if (typeof theme.id !== "string" || !theme.id) return null;
  if (typeof theme.title !== "string" || !theme.title.trim()) return null;
  const status =
    theme.status === "discussed" || theme.status === "archived" || theme.status === "active"
      ? theme.status
      : null;
  if (!status) return null;
  const quotes = Array.isArray(theme.quotes)
    ? theme.quotes.map(normalizeQuote).filter((quote): quote is ThemeQuote => Boolean(quote)).slice(0, 8)
    : [];
  const peakFeeling =
    typeof theme.peakFeeling === "string" && isFeeling(theme.peakFeeling)
      ? theme.peakFeeling
      : undefined;
  const next: SessionTheme = {
    id: theme.id,
    userId: typeof theme.userId === "string" && theme.userId ? theme.userId : "local",
    title: theme.title.replace(/\s+/g, " ").trim().slice(0, 80),
    status,
    count: typeof theme.count === "number" && theme.count >= 0 ? Math.round(theme.count) : quotes.length,
    firstSeen:
      typeof theme.firstSeen === "string" && DATE_RE.test(theme.firstSeen)
        ? theme.firstSeen
        : quotes[0]?.date ?? "1970-01-01",
    lastSeen:
      typeof theme.lastSeen === "string" && DATE_RE.test(theme.lastSeen)
        ? theme.lastSeen
        : quotes[quotes.length - 1]?.date ?? "1970-01-01",
    peakIntensity:
      typeof theme.peakIntensity === "number"
        ? Math.min(10, Math.max(0, Math.round(theme.peakIntensity)))
        : 0,
    reopened: theme.reopened === true,
    dismissed: theme.dismissed === true,
    confidence: typeof theme.confidence === "number" ? Math.min(1, Math.max(0, theme.confidence)) : 0,
    summary:
      typeof theme.summary === "string" && theme.summary.trim()
        ? theme.summary.replace(/\s+/g, " ").trim().slice(0, 120)
        : theme.title.replace(/\s+/g, " ").trim().slice(0, 80),
    quotes,
    updatedAt: typeof theme.updatedAt === "string" ? theme.updatedAt : new Date(0).toISOString(),
  };
  if (peakFeeling) next.peakFeeling = peakFeeling;
  if (theme.manual === true) next.manual = true;
  return next;
}

function normalizeLink(raw: unknown): ThemeLink | null {
  const link = asRecord(raw);
  if (!link) return null;
  if (typeof link.entryId !== "string" || !link.entryId) return null;
  if (typeof link.themeId !== "string" || !link.themeId) return null;
  const confidence = typeof link.confidence === "number" ? link.confidence : 0;
  return {
    entryId: link.entryId,
    themeId: link.themeId,
    confidence: Math.min(1, Math.max(0, confidence)),
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
    themes: Array.isArray(store.themes)
      ? store.themes.map(normalizeTheme).filter((theme): theme is SessionTheme => Boolean(theme)).slice(0, 40)
      : [],
    themeLinks: Array.isArray(store.themeLinks)
      ? store.themeLinks.map(normalizeLink).filter((link): link is ThemeLink => Boolean(link)).slice(0, 400)
      : [],
    judgeSettled: Array.isArray(store.judgeSettled)
      ? store.judgeSettled.filter((item): item is string => typeof item === "string" && item.length < 80).slice(0, 400)
      : [],
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
