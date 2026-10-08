import type { TherapyStore } from "./types";

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
      store?: TherapyStore;
      timeZone?: string | null;
    };
    if (!data.ok || !data.store) {
      return { ok: false, status: res.status, error: "bad_response" };
    }
    return {
      ok: true,
      store: data.store,
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

/** Prefer newer entries/sessions/weekPreps by updatedAt; keep all unique ids. */
export function mergeStores(a: TherapyStore, b: TherapyStore): TherapyStore {
  return {
    version: 1,
    entries: mergeById(a.entries, b.entries),
    sessions: mergeById(a.sessions, b.sessions),
    weekPreps: mergeWeekPreps(a.weekPreps, b.weekPreps),
  };
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
  // Also collapse same-date journal entries: keep newer, prefer longer body if tie
  return [...map.values()];
}

function mergeWeekPreps(
  left: TherapyStore["weekPreps"],
  right: TherapyStore["weekPreps"],
): TherapyStore["weekPreps"] {
  const map = new Map<string, TherapyStore["weekPreps"][number]>();
  for (const item of [...left, ...right]) {
    const prev = map.get(item.weekKey);
    if (!prev || prev.updatedAt < item.updatedAt) {
      map.set(item.weekKey, item);
    }
  }
  return [...map.values()];
}

/** Collapse duplicate date entries after merge (bot + mini app). */
export function collapseJournalByDate(store: TherapyStore): TherapyStore {
  const byDate = new Map<string, TherapyStore["entries"][number]>();
  for (const entry of store.entries) {
    const prev = byDate.get(entry.date);
    if (!prev) {
      byDate.set(entry.date, entry);
      continue;
    }
    // Prefer newer; if bot appended into one and mini app has another, join bodies
    if (prev.updatedAt > entry.updatedAt) {
      byDate.set(entry.date, joinBodies(prev, entry));
    } else if (entry.updatedAt > prev.updatedAt) {
      byDate.set(entry.date, joinBodies(entry, prev));
    } else {
      byDate.set(
        entry.date,
        entry.body.length >= prev.body.length
          ? joinBodies(entry, prev)
          : joinBodies(prev, entry),
      );
    }
  }
  return {
    ...store,
    entries: [...byDate.values()].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    ),
  };
}

function joinBodies(
  primary: TherapyStore["entries"][number],
  secondary: TherapyStore["entries"][number],
): TherapyStore["entries"][number] {
  if (!secondary.body.trim()) return primary;
  if (!primary.body.trim()) {
    return { ...primary, body: secondary.body, tags: uniqTags(primary.tags, secondary.tags) };
  }
  if (primary.body.includes(secondary.body.trim())) return primary;
  if (secondary.body.includes(primary.body.trim())) {
    return {
      ...primary,
      body: secondary.body,
      tags: uniqTags(primary.tags, secondary.tags),
      mood: primary.mood !== 3 ? primary.mood : secondary.mood,
    };
  }
  return {
    ...primary,
    body: `${primary.body.trim()}\n\n${secondary.body.trim()}`,
    tags: uniqTags(primary.tags, secondary.tags),
    mood: primary.mood !== 3 ? primary.mood : secondary.mood,
  };
}

function uniqTags(a: string[], b: string[]): string[] {
  const out: string[] = [];
  for (const t of [...a, ...b]) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 8);
}
