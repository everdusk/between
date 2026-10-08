"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createId, weekKey } from "@/lib/dates";
import {
  collapseJournalByDate,
  fetchJournal,
  mergeStores,
  putJournal,
} from "@/lib/journal-api";
import { clearStore, loadStore, saveStore } from "@/lib/storage";
import {
  emptyStore,
  type JournalEntry,
  type MoodLevel,
  type SessionNote,
  type TherapyStore,
  type WeekPrep,
} from "@/lib/types";

type Status = "loading" | "ready" | "error";

function subscribe() {
  return () => {};
}

function getServerSnapshot() {
  return false;
}

function getClientSnapshot() {
  return true;
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function useTherapyStore(options?: {
  initData?: string;
  inTelegram?: boolean;
}) {
  const initData = options?.initData ?? "";
  const inTelegram = Boolean(options?.inTelegram && initData);

  const hydrated = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const [store, setStore] = useState<TherapyStore>(emptyStore);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [syncLabel, setSyncLabel] = useState<"local" | "cloud" | "offline-cloud">(
    "local",
  );
  const storeRef = useRef(store);
  storeRef.current = store;
  const initDataRef = useRef(initData);
  initDataRef.current = initData;

  const applyLocal = useCallback((next: TherapyStore) => {
    const result = saveStore(next);
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
      return true;
    }
    setError(result.error);
    setStatus("error");
    return false;
  }, []);

  const syncFromCloud = useCallback(async () => {
    const data = initDataRef.current;
    if (!data) return;
    const remote = await fetchJournal(data);
    if (!remote.ok) {
      if (remote.status === 503 || remote.status === 401) {
        setSyncLabel("offline-cloud");
      }
      return;
    }
    const local = loadStore();
    const localStore = local.ok ? local.data : emptyStore();
    const merged = collapseJournalByDate(
      mergeStores(localStore, remote.store),
    );
    applyLocal(merged);
    setSyncLabel("cloud");
    const tz = deviceTimeZone();
    void putJournal(data, merged, tz);
  }, [applyLocal]);

  useEffect(() => {
    if (!hydrated) return;
    const result = loadStore();
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
    } else {
      setStatus("error");
      setError(result.error);
      return;
    }

    if (inTelegram) {
      void syncFromCloud();
    } else {
      setSyncLabel("local");
    }
  }, [hydrated, inTelegram, syncFromCloud]);

  // Refresh when Mini App regains focus (picks up bot-appended lines)
  useEffect(() => {
    if (!inTelegram) return;
    const onFocus = () => {
      void syncFromCloud();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void syncFromCloud();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [inTelegram, syncFromCloud]);

  const persist = useCallback(
    (next: TherapyStore) => {
      const ok = applyLocal(next);
      if (!ok) return false;
      if (initDataRef.current) {
        const tz = deviceTimeZone();
        void putJournal(initDataRef.current, next, tz).then((cloudOk) => {
          setSyncLabel(cloudOk ? "cloud" : "offline-cloud");
        });
      }
      return true;
    },
    [applyLocal],
  );

  const resetCorrupted = useCallback(() => {
    const result = clearStore();
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
      if (initDataRef.current) {
        void putJournal(initDataRef.current, result.data, deviceTimeZone());
      }
    } else {
      setError(result.error);
    }
  }, []);

  const upsertEntry = useCallback(
    (input: {
      id?: string;
      date: string;
      mood: MoodLevel;
      body: string;
      tags: string[];
    }) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.entries.find(
        (e) => e.id === input.id || (!input.id && e.date === input.date),
      );
      let entries: JournalEntry[];
      if (existing) {
        entries = current.entries.map((e) =>
          e.id === existing.id
            ? {
                ...e,
                date: input.date,
                mood: input.mood,
                body: input.body,
                tags: input.tags,
                updatedAt: now,
              }
            : e,
        );
      } else {
        entries = [
          {
            id: createId(),
            date: input.date,
            mood: input.mood,
            body: input.body,
            tags: input.tags,
            updatedAt: now,
          },
          ...current.entries,
        ];
      }
      return persist({ ...current, entries });
    },
    [persist],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      const current = storeRef.current;
      return persist({
        ...current,
        entries: current.entries.filter((e) => e.id !== id),
      });
    },
    [persist],
  );

  const saveWeekPrep = useCallback(
    (key: string, talkNotes: string) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((w) => w.weekKey === key);
      let weekPreps: WeekPrep[];
      if (existing) {
        weekPreps = current.weekPreps.map((w) =>
          w.weekKey === key ? { ...w, talkNotes, updatedAt: now } : w,
        );
      } else {
        weekPreps = [
          ...current.weekPreps,
          { weekKey: key, talkNotes, updatedAt: now },
        ];
      }
      return persist({ ...current, weekPreps });
    },
    [persist],
  );

  const upsertSession = useCallback(
    (input: {
      id?: string;
      date: string;
      summary: string;
      insights: string;
      homework: string;
    }) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const wk = weekKey(new Date(input.date + "T12:00:00"));
      let sessions: SessionNote[];
      if (input.id) {
        sessions = current.sessions.map((s) =>
          s.id === input.id
            ? {
                ...s,
                date: input.date,
                summary: input.summary,
                insights: input.insights,
                homework: input.homework,
                weekKey: wk,
                updatedAt: now,
              }
            : s,
        );
      } else {
        sessions = [
          {
            id: createId(),
            date: input.date,
            summary: input.summary,
            insights: input.insights,
            homework: input.homework,
            weekKey: wk,
            updatedAt: now,
          },
          ...current.sessions,
        ];
      }
      return persist({ ...current, sessions });
    },
    [persist],
  );

  const deleteSession = useCallback(
    (id: string) => {
      const current = storeRef.current;
      return persist({
        ...current,
        sessions: current.sessions.filter((s) => s.id !== id),
      });
    },
    [persist],
  );

  const entryForDate = useCallback(
    (date: string) => store.entries.find((e) => e.date === date) ?? null,
    [store.entries],
  );

  return {
    store,
    status: hydrated ? status : "loading",
    error,
    syncLabel,
    resetCorrupted,
    upsertEntry,
    deleteEntry,
    saveWeekPrep,
    upsertSession,
    deleteSession,
    entryForDate,
    refreshCloud: syncFromCloud,
  };
}
