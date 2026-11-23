import { reviewEvents } from "./theme-review";
import type { LocaleId } from "./i18n";
import { normalizeStore } from "./migrate";
import {
  emptyNotify,
  type NotifyPrefs,
  type SessionPlan,
  type SessionTheme,
  type ThemeLink,
  type TherapyStore,
  type WeekPrep,
} from "./types";

export type JournalFetchResult =
  | { ok: true; store: TherapyStore; timeZone: string | null; cacheId:string; reviewPilot:boolean }
  | { ok: false; status: number; error: string };

/** Headers that name whose journal this is. A MAX launch string wins over a website cookie. */
export function journalAuthHeaders(
  initData: string,
  maxInitData = "",
  json = false,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  if (maxInitData) headers["X-Max-Init-Data"] = maxInitData;
  return headers;
}

export async function fetchJournal(
  initData: string,
  maxInitData = "",
): Promise<JournalFetchResult> {
  try {
    const res = await fetch("/api/journal", {
      method: "GET",
      headers: journalAuthHeaders(initData, maxInitData),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: res.status === 503 ? "server_not_configured" : "fetch_failed",
      };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      store?: unknown;
      cacheId?: unknown;
      reviewPilot?: boolean;
      timeZone?: string | null;
    };
    const store = normalizeStore(data.store);
    if (!data.ok || !store || typeof data.cacheId !== "string" || !data.cacheId) {
      return { ok: false, status: res.status, error: "bad_response" };
    }
    return {
      ok: true,
      store,
      cacheId:data.cacheId,
      reviewPilot:data.reviewPilot === true,
      timeZone: data.timeZone ?? null,
    };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

export async function putJournal(
  initData: string,
  store: TherapyStore,
  timeZone?: string | null,
  options?: { dropEntryIds?: string[]; dropSessionIds?: string[]; replace?: boolean },
  maxInitData = "",
  cacheId = "",
): Promise<boolean> {
  try {
    const res = await fetch("/api/journal", {
      method: "PUT",
      headers: {...journalAuthHeaders(initData, maxInitData, true),"X-Journal-Cache":cacheId},
      body: JSON.stringify({
        store,
        timeZone: timeZone || undefined,
        dropEntryIds: options?.dropEntryIds,
        dropSessionIds: options?.dropSessionIds,
        replace: options?.replace || undefined,
      }),
    });
    return res.ok && (await res.json())?.ok === true;
  } catch {
    return false;
  }
}

export async function requestBrief(
  initData: string,
  facts: string,
  stamp: string,
  locale: LocaleId = "ru",
  kind: "brief" | "backlog" | "themes" | "judge" | "dedup" | "pattern" | "review" | "reviewJudge" = "brief",
  maxInitData = "",
): Promise<
  | { ok: true; text: string | null; reason?: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/brief", {
      method: "POST",
      headers: journalAuthHeaders(initData, maxInitData, true),
      body: JSON.stringify({ facts, stamp, locale, kind }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      text?: string | null;
      reason?: string;
      detail?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "brief_failed" };
    }
    return {
      ok: true,
      text: data.text ?? null,
      reason: data.detail ? `${data.reason ?? "model_failed"}:${data.detail}` : data.reason,
    };
  } catch {
    return { ok: false, error: "network" };
  }
}

function newerThan(a: string, b: string): boolean {
  return a >= b;
}

function mergeById<T extends { id: string; updatedAt: string }>(
  left: T[],
  right: T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of [...left, ...right]) {
    const prev = map.get(item.id);
    if (!prev || prev.updatedAt < item.updatedAt) {
      map.set(item.id, item);
    }
  }
  return [...map.values()];
}

function filled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/**
 * A newer week must not wipe a field it left blank.
 * When both sides have text, the newer `updatedAt` wins.
 */
function mergeWeekPrep(prev: WeekPrep, item: WeekPrep): WeekPrep {
  const newer = prev.updatedAt < item.updatedAt ? item : prev;
  const older = newer === item ? prev : item;
  const next: WeekPrep = { ...newer };
  if (!next.reviewSummary && older.reviewSummary) next.reviewSummary = older.reviewSummary;
  if (!filled(next.talkNotes) && filled(older.talkNotes)) next.talkNotes = older.talkNotes;
  if (!filled(next.briefText) && filled(older.briefText)) {
    next.briefText = older.briefText;
    next.briefStamp = older.briefStamp;
  }
  if (!filled(next.patternText) && filled(older.patternText)) {
    next.patternText = older.patternText;
    next.patternStamp = older.patternStamp;
  }
  return next;
}

function mergeWeekPreps(left: WeekPrep[], right: WeekPrep[]): WeekPrep[] {
  const map = new Map<string, WeekPrep>();
  for (const item of [...left, ...right]) {
    const prev = map.get(item.weekKey);
    map.set(item.weekKey, prev ? mergeWeekPrep(prev, item) : item);
  }
  return [...map.values()];
}

const TOMBSTONE_CAP = 400;

export function tombstoneIds(ids: string[] | undefined, id: string): string[] {
  return [...new Set([...(ids ?? []), id].filter((item) => item.length > 0))].slice(-TOMBSTONE_CAP);
}

function unionIds(...lists: Array<string[] | undefined>): string[] {
  return [...new Set(lists.flatMap((list) => list ?? []).filter((item) => item.length > 0))].slice(
    -TOMBSTONE_CAP,
  );
}

function mergePlan(a: SessionPlan | null, b: SessionPlan | null): SessionPlan | null {
  if (!a) return b;
  if (!b) return a;
  return newerThan(a.updatedAt, b.updatedAt) ? a : b;
}

function mergeNotify(a: NotifyPrefs, b: NotifyPrefs): NotifyPrefs {
  if (!a.updatedAt && !b.updatedAt) return emptyNotify();
  return newerThan(a.updatedAt, b.updatedAt) ? a : b;
}

function mergeLinks(left: ThemeLink[] = [], right: ThemeLink[] = []): ThemeLink[] {
  const groups = new Map<string, ThemeLink[]>();
  for (const snapshot of [left, right]) {
    const incoming = new Map<string, ThemeLink[]>();
    for (const link of snapshot) {
      const group = incoming.get(link.entryId);
      if (group) group.push(link);
      else incoming.set(link.entryId, [link]);
    }
    for (const [entryId, group] of incoming) {
      const prev = groups.get(entryId);
      const date = group[0].judgedAt ?? "";
      const prevDate = prev?.[0].judgedAt ?? "";
      if (!prev || date > prevDate || (date === prevDate && group[0].confidence >= prev[0].confidence)) {
        groups.set(entryId, group);
      }
    }
  }
  return [...groups.values()].flat();
}

/**
 * A client snapshot must not erase a note it never saw.
 * `dropEntryIds` / `dropSessionIds` are the only deletions.
 */
export function applyJournalWrite(
  current: TherapyStore,
  incoming: TherapyStore,
  dropEntryIds: string[] = [],
  dropSessionIds: string[] = [],
): TherapyStore {
  return mergeStores(
    {
      ...current,
      droppedEntryIds: unionIds(current.droppedEntryIds, dropEntryIds),
      droppedSessionIds: unionIds(current.droppedSessionIds, dropSessionIds),
    },
    incoming,
  );
}

function entryStamp(entry: TherapyStore["entries"][number]): string {
  return JSON.stringify({
    reflection: entry.reflection,
    body: entry.body,
    date: entry.date,
    feelings: entry.feelings,
    tags: entry.tags,
    createdAt: entry.createdAt,
    slot: entry.slot ?? null,
    source: entry.source ?? null,
  });
}

/** True when a locked journal is not gaining, editing, or losing notes. */
export function entriesHeld(previous: TherapyStore | null, next: TherapyStore): boolean {
  const before = previous?.entries ?? [];
  if (before.length !== next.entries.length) return false;
  const stamps = new Map(before.map((entry) => [entry.id, entryStamp(entry)]));
  return next.entries.every((entry) => stamps.get(entry.id) === entryStamp(entry));
}

/** Keep every note. Same id keeps the newer copy; a deleted id stays deleted. */
export function mergeStores(a: TherapyStore, b: TherapyStore): TherapyStore {
  const droppedEntryIds = unionIds(a.droppedEntryIds, b.droppedEntryIds);
  const droppedSessionIds = unionIds(a.droppedSessionIds, b.droppedSessionIds);
  const goneEntries = new Set(droppedEntryIds);
  const goneSessions = new Set(droppedSessionIds);
  const themes = mergeById(a.themes ?? [], b.themes ?? []);
  const redirects = new Map<string, string>();
  function resolved(id: string): string {
    while (redirects.has(id)) id = redirects.get(id)!;
    return id;
  }
  // Apply recorded consolidations even if the other device still has the original topic.
  for (const theme of [...(a.themes ?? []), ...(b.themes ?? [])]
    .filter((item) => item.mergedIds?.length)
    .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt) || x.id.localeCompare(y.id))) {
    for (const old of theme.mergedIds!) {
      const keep = resolved(theme.id);
      if (keep !== old && !redirects.has(old)) redirects.set(old, keep);
    }
  }
  const histories = new Map<string, NonNullable<SessionTheme["review"]>>();
  for (const theme of [...(a.themes ?? []), ...(b.themes ?? [])]) {
    if (theme.review?.length) {
      const id = resolved(theme.id);
      histories.set(id, reviewEvents([...(histories.get(id) ?? []), ...theme.review]));
    }
  }
  const aliases = new Map<string, string[]>();
  for (const old of redirects.keys()) {
    const keep = resolved(old);
    const group = aliases.get(keep) ?? [];
    group.push(old);
    aliases.set(keep, group);
  }
  const links = mergeLinks(a.themeLinks, b.themeLinks).filter((link) => !goneEntries.has(link.entryId));
  const pairs = new Map<string, ThemeLink>();
  const classified = new Set<string>();
  const linkCounts = new Map<string, number>();
  for (const link of links) {
    const themeId = resolved(link.themeId);
    const key = JSON.stringify([link.entryId, themeId]);
    if (!pairs.has(key)) linkCounts.set(themeId, (linkCounts.get(themeId) ?? 0) + 1);
    if (link.judgedAt) classified.add(link.entryId);
    pairs.set(key, themeId === link.themeId ? link : { ...link, themeId });
  }
  const merged: TherapyStore = {
    ...(a.introductions || b.introductions ? {introductions: [...new Map([...(a.introductions ?? []), ...(b.introductions ?? [])].map(r=>[r.attempt,r])).values()]} : {}),
    profile: (a.profile?.updatedAt ?? "") > (b.profile?.updatedAt ?? "") ? a.profile : b.profile ?? a.profile,
    version: 2,
    entries: mergeById(a.entries, b.entries).filter((entry) => !goneEntries.has(entry.id)),
    sessions: mergeById(a.sessions, b.sessions).filter((session) => !goneSessions.has(session.id)),
    weekPreps: mergeWeekPreps(a.weekPreps, b.weekPreps),
    sessionPlan: mergePlan(a.sessionPlan, b.sessionPlan),
    notify: mergeNotify(a.notify, b.notify),
    themes: themes.filter((theme) => !redirects.has(theme.id)).map((theme) => {
      const review = histories.get(theme.id);
      if (review) theme = { ...theme, review };
      const mergedIds = aliases.get(theme.id);
      const quotes = theme.quotes.filter((q) => !goneEntries.has(q.entryId) &&
        (!classified.has(q.entryId) || pairs.has(JSON.stringify([q.entryId, theme.id]))));
      const lost = theme.quotes.length !== quotes.length;
      const count = linkCounts.get(theme.id) ?? 0;
      if (!mergedIds && !lost && count <= theme.count) return theme;
      return { ...theme, ...(mergedIds ? { mergedIds } : {}), quotes,
        count: Math.max(count, lost ? new Set(quotes.map((q) => q.entryId)).size : theme.count, theme.manual ? 1 : 0) };
    }),
    themeLinks: [...pairs.values()],
    judgeSettled: [...new Set([...(a.judgeSettled ?? []), ...(b.judgeSettled ?? [])])],
  };
  if (droppedEntryIds.length) merged.droppedEntryIds = droppedEntryIds;
  if (droppedSessionIds.length) merged.droppedSessionIds = droppedSessionIds;
  return merged;
}
