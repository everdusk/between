import { normalizeStore } from "./migrate";
import {
  emptyNotify,
  type NotifyPrefs,
  type SessionPlan,
  type TherapyStore,
  type WeekPrep,
} from "./types";

export type JournalFetchResult =
  | { ok: true; store: TherapyStore; timeZone: string | null }
  | { ok: false; status: number; error: string };

export async function fetchJournal(
  initData: string,
): Promise<JournalFetchResult> {
  try {
    const res = await fetch("/api/journal", {
      method: "GET",
      headers: { "X-Telegram-Init-Data": initData },
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
): Promise<boolean> {
  try {
    const res = await fetch("/api/journal", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ store, timeZone: timeZone || undefined }),
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
): Promise<
  | { ok: true; text: string | null; reason?: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/brief", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ facts, stamp }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      text?: string | null;
      reason?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "brief_failed" };
    }
    return { ok: true, text: data.text ?? null, reason: data.reason };
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

/** Keep every note. Same id keeps the newer copy; different notes on one day stay separate. */
export function mergeStores(a: TherapyStore, b: TherapyStore): TherapyStore {
  return {
    version: 2,
    entries: mergeById(a.entries, b.entries),
    sessions: mergeById(a.sessions, b.sessions),
    weekPreps: mergeWeekPreps(a.weekPreps, b.weekPreps),
    sessionPlan: mergePlan(a.sessionPlan, b.sessionPlan),
    notify: mergeNotify(a.notify, b.notify),
  };
}
