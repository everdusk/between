"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createId, weekKey } from "@/lib/dates";
import { isFeeling } from "@/lib/feelings";
import { fetchJournal, mergeStores, putJournal } from "@/lib/journal-api";
import { sanitizeTags } from "@/lib/tags";
import { clearStore, loadStore, saveStore } from "@/lib/storage";
import {
  emptyStore,
  type Feeling,
  type JournalEntry,
  type NotifyPrefs,
  type SessionNote,
  type SessionPlan,
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
  const initDataRef = useRef(initData);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  useEffect(() => {
    initDataRef.current = initData;
  }, [initData]);

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
    const merged = mergeStores(localStore, remote.store);
    applyLocal(merged);
    setSyncLabel("cloud");
    const tz = deviceTimeZone();
    void putJournal(data, merged, tz);
  }, [applyLocal]);

  useEffect(() => {
    if (!hydrated) return;
    const result = loadStore();
    if (result.ok) {
      // Local journal is only available after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate localStorage once on the client
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
      body: string;
      feelings: Feeling[];
      tags: string[];
    }) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = input.id
        ? current.entries.find((entry) => entry.id === input.id)
        : undefined;
      const feelings = input.feelings.filter(isFeeling).slice(0, 6);
      const tags = sanitizeTags(input.tags);
      let entries: JournalEntry[];
      if (existing) {
        entries = current.entries.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                date: input.date,
                body: input.body,
                feelings,
                tags,
                updatedAt: now,
              }
            : entry,
        );
      } else {
        entries = [
          {
            id: createId(),
            date: input.date,
            createdAt: now,
            updatedAt: now,
            body: input.body,
            feelings,
            tags,
            source: "app",
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
        entries: current.entries.filter((entry) => entry.id !== id),
      });
    },
    [persist],
  );

  const saveWeekPrep = useCallback(
    (key: string, talkNotes: string) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      let weekPreps: WeekPrep[];
      if (existing) {
        weekPreps = current.weekPreps.map((prep) =>
          prep.weekKey === key ? { ...prep, talkNotes, updatedAt: now } : prep,
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

  const saveBrief = useCallback(
    (key: string, briefText: string, briefStamp: string, talkNotes: string) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      const next: WeekPrep = {
        weekKey: key,
        talkNotes,
        updatedAt: now,
        briefText,
        briefStamp,
      };
      const weekPreps = existing
        ? current.weekPreps.map((prep) => (prep.weekKey === key ? { ...prep, ...next } : prep))
        : [...current.weekPreps, next];
      return persist({ ...current, weekPreps });
    },
    [persist],
  );

  const saveSessionPlan = useCallback(
    (input: Omit<SessionPlan, "updatedAt">) => {
      const current = storeRef.current;
      const sessionPlan: SessionPlan = { ...input, updatedAt: new Date().toISOString() };
      return persist({ ...current, sessionPlan });
    },
    [persist],
  );

  const saveNotify = useCallback(
    (input: Pick<NotifyPrefs, "moodPolls" | "eveningNudge">) => {
      const current = storeRef.current;
      return persist({
        ...current,
        notify: { ...input, updatedAt: new Date().toISOString() },
      });
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
        sessions = current.sessions.map((session) =>
          session.id === input.id
            ? {
                ...session,
                date: input.date,
                summary: input.summary,
                insights: input.insights,
                homework: input.homework,
                weekKey: wk,
                updatedAt: now,
              }
            : session,
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
        sessions: current.sessions.filter((session) => session.id !== id),
      });
    },
    [persist],
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
    saveBrief,
    saveSessionPlan,
    saveNotify,
    upsertSession,
    deleteSession,
    refreshCloud: syncFromCloud,
  };
}
