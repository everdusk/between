"use client";

import { useCallback, useEffect, useState } from "react";
import { createId, toDateKey, weekKey } from "@/lib/dates";
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

export function useTherapyStore() {
  const [store, setStore] = useState<TherapyStore>(emptyStore);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const result = loadStore();
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }, []);

  const persist = useCallback((next: TherapyStore) => {
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

  const resetCorrupted = useCallback(() => {
    const result = clearStore();
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
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
      const existing = store.entries.find(
        (e) => e.id === input.id || (!input.id && e.date === input.date),
      );
      let entries: JournalEntry[];
      if (existing) {
        entries = store.entries.map((e) =>
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
          ...store.entries,
        ];
      }
      return persist({ ...store, entries });
    },
    [persist, store],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      return persist({
        ...store,
        entries: store.entries.filter((e) => e.id !== id),
      });
    },
    [persist, store],
  );

  const saveWeekPrep = useCallback(
    (key: string, talkNotes: string) => {
      const now = new Date().toISOString();
      const existing = store.weekPreps.find((w) => w.weekKey === key);
      let weekPreps: WeekPrep[];
      if (existing) {
        weekPreps = store.weekPreps.map((w) =>
          w.weekKey === key ? { ...w, talkNotes, updatedAt: now } : w,
        );
      } else {
        weekPreps = [
          ...store.weekPreps,
          { weekKey: key, talkNotes, updatedAt: now },
        ];
      }
      return persist({ ...store, weekPreps });
    },
    [persist, store],
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
      const wk = weekKey(new Date(input.date + "T12:00:00"));
      let sessions: SessionNote[];
      if (input.id) {
        sessions = store.sessions.map((s) =>
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
          ...store.sessions,
        ];
      }
      return persist({ ...store, sessions });
    },
    [persist, store],
  );

  const deleteSession = useCallback(
    (id: string) => {
      return persist({
        ...store,
        sessions: store.sessions.filter((s) => s.id !== id),
      });
    },
    [persist, store],
  );

  const entryForDate = useCallback(
    (date: string = toDateKey()) =>
      store.entries.find((e) => e.date === date) ?? null,
    [store.entries],
  );

  return {
    store,
    status,
    error,
    resetCorrupted,
    upsertEntry,
    deleteEntry,
    saveWeekPrep,
    upsertSession,
    deleteSession,
    entryForDate,
  };
}
