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
  | { ok: true; store: TherapyStore; timeZone: string | null }
  | { ok: false; status: number; error: string };

function journalHeaders(initData: string, json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  if (initData) headers["X-Telegram-Init-Data"] = initData;
  return headers;
}

export async function fetchJournal(
  initData: string,
): Promise<JournalFetchResult> {
  try {
    const res = await fetch("/api/journal", {
      method: "GET",
      headers: journalHeaders(initData),
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
      timeZone?: string | null;
    };
    const store = normalizeStore(data.store);
    if (!data.ok || !store) {
      return { ok: false, status: res.status, error: "bad_response" };
    }
    return {
      ok: true,
      store,
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
): Promise<boolean> {
  try {
    const res = await fetch("/api/journal", {
      method: "PUT",
      headers: journalHeaders(initData, true),
      body: JSON.stringify({
        store,
        timeZone: timeZone || undefined,
        dropEntryIds: options?.dropEntryIds,
        dropSessionIds: options?.dropSessionIds,
        replace: options?.replace || undefined,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function requestBrief(
  initData: string,
  facts: string,
  stamp: string,
  locale: LocaleId = "ru",
  kind: "brief" | "backlog" | "themes" | "judge" | "dedup" | "pattern" = "brief",
): Promise<
  | { ok: true; text: string | null; reason?: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/brief", {
      method: "POST",
      headers: journalHeaders(initData, true),
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

function mergeWeekPreps(left: WeekPrep[], right: WeekPrep[]): WeekPrep[] {
  const map = new Map<string, WeekPrep>();
  for (const item of [...left, ...right]) {
    const prev = map.get(item.weekKey);
    if (!prev || prev.updatedAt < item.updatedAt) {
      map.set(item.weekKey, item);
    }
  }
  return [...map.values()];
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

function mergeThemes(left: SessionTheme[] = [], right: SessionTheme[] = []): SessionTheme[] {
  return mergeById(left, right);
}

function mergeLinks(left: ThemeLink[] = [], right: ThemeLink[] = []): ThemeLink[] {
  const map = new Map<string, ThemeLink>();
  for (const link of [...left, ...right]) {
    const prev = map.get(link.entryId);
    if (!prev || link.confidence >= prev.confidence) map.set(link.entryId, link);
  }
  return [...map.values()];
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
  const merged = mergeStores(current, incoming);
  const entries = new Set(dropEntryIds);
  const sessions = new Set(dropSessionIds);
  return {
    ...merged,
    entries: entries.size ? merged.entries.filter((entry) => !entries.has(entry.id)) : merged.entries,
    sessions: sessions.size
      ? merged.sessions.filter((session) => !sessions.has(session.id))
      : merged.sessions,
  };
}

/** Keep every note. Same id keeps the newer copy; different notes on one day stay separate. */
export function mergeStores(a: TherapyStore, b: TherapyStore): TherapyStore {
  return {
    version: 2,
    entries: mergeById(a.entries, b.entries),
    sessions: mergeById(a.sessions, b.sessions),
    weekPreps: mergeWeekPreps(a.weekPreps, b.weekPreps),
    sessionPlan: mergePlan(a.sessionPlan, b.sessionPlan),
    notify: mergeNotify(a.notify, b.notify),
    themes: mergeThemes(a.themes, b.themes),
    themeLinks: mergeLinks(a.themeLinks, b.themeLinks),
    judgeSettled: [...new Set([...(a.judgeSettled ?? []), ...(b.judgeSettled ?? [])])],
  };
}
