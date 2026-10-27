"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createId, toDateKey, weekKey } from "@/lib/dates";
import { isFeeling } from "@/lib/feelings";
import { fetchJournal, mergeStores, putJournal, requestBrief } from "@/lib/journal-api";
import type { LocaleId } from "@/lib/i18n";
import { therapyWindow } from "@/lib/session-summary";
import {
  addManualTheme,
  applyVerdict,
  dedupFacts,
  discussTheme,
  dismissTheme,
  judgeFacts,
  mergeThemes,
  judgeStamp,
  parseDedupHit,
  parseJudgeVerdict,
  pendingJudgeEntries,
  themesForJudge,
} from "@/lib/themes";
import { applyThemePass, isTherapyTheme, sanitizeTags, splitTags } from "@/lib/tags";
import { clearStore, loadStore, saveStore } from "@/lib/storage";
import {
  emptyStore,
  type Feeling,
  type JournalEntry,
  type NotifyPrefs,
  type SessionNote,
  type BacklogItem,
  type BacklogSource,
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
  locale?: LocaleId;
}) {
  const initData = options?.initData ?? "";
  const inTelegram = Boolean(options?.inTelegram && initData);
  const locale = options?.locale ?? "ru";

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

  const judgeRun = useRef<string | null>(null);
  const judgeTries = useRef<Record<string, number>>({});
  const judgeTimer = useRef<number | null>(null);
  const [judgeNudge, setJudgeNudge] = useState(0);
  useEffect(() => {
    if (!hydrated || !initData) return;
    const today = toDateKey();
    const period = therapyWindow(store.sessions, store.entries, today);
    const pending = pendingJudgeEntries(store.entries, store.judgeSettled ?? [], period.days);
    const entry = pending[0];
    if (!entry) return;
    const stamp = judgeStamp(entry);
    if (judgeRun.current === stamp) return;
    judgeRun.current = stamp;
    let cancelled = false;
    void (async () => {
      const facts = judgeFacts(themesForJudge(storeRef.current.themes ?? []), entry);
      const result = await requestBrief(initData, facts, `j:${stamp}`, locale, "judge");
      if (cancelled) return;
      const verdict = result.ok && result.text ? parseJudgeVerdict(result.text) : null;
      if (!verdict) {
        const tries = (judgeTries.current[stamp] ?? 0) + 1;
        judgeTries.current[stamp] = tries;
        judgeRun.current = null;
        if (!cancelled && tries < 3) {
          if (judgeTimer.current !== null) window.clearTimeout(judgeTimer.current);
          judgeTimer.current = window.setTimeout(() => {
            judgeTimer.current = null;
            setJudgeNudge((n) => n + 1);
          }, 8000);
        }
        return;
      }
      const applied = applyVerdict(
        { themes: storeRef.current.themes ?? [], links: storeRef.current.themeLinks ?? [] },
        entry,
        verdict,
      );
      let state = applied.state;
      let focus = applied.touchedId;
      for (let pass = 0; pass < 2 && focus; pass += 1) {
        const theme = state.themes.find(
          (item) => item.id === focus && item.status === "active" && !item.dismissed,
        );
        const others = state.themes.filter(
          (item) => item.id !== focus && item.status === "active" && !item.dismissed,
        );
        if (!theme || others.length === 0) break;
        const dedup = await requestBrief(
          initData,
          dedupFacts(theme, others),
          `d:${stamp}:${pass}`,
          locale,
          "dedup",
        );
        if (cancelled) return;
        const hit = dedup.ok && dedup.text ? parseDedupHit(dedup.text) : null;
        if (!hit || hit.confidence < 0.85 || hit.themeId === focus) break;
        state = mergeThemes(state, hit.themeId, focus, hit.title);
        focus = hit.themeId;
      }
      if (cancelled) return;
      const latest = storeRef.current;
      persist({
        ...latest,
        themes: state.themes,
        themeLinks: state.links,
        judgeSettled: [...new Set([...(latest.judgeSettled ?? []), stamp])].slice(-400),
      });
    })();
    return () => {
      cancelled = true;
      if (judgeRun.current === stamp) judgeRun.current = null;
      if (judgeTimer.current !== null) {
        window.clearTimeout(judgeTimer.current);
        judgeTimer.current = null;
      }
    };
  }, [hydrated, initData, judgeNudge, locale, persist, store.entries, store.judgeSettled, store.sessions]);

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
      themeHidden?: string[];
    }) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = input.id
        ? current.entries.find((entry) => entry.id === input.id)
        : undefined;
      const feelings = input.feelings.filter(isFeeling).slice(0, 6);
      const userTags = sanitizeTags(input.tags);
      const themeHidden = sanitizeTags(input.themeHidden ?? []).filter(
        (tag) => isTherapyTheme(tag) && !userTags.includes(tag),
      );
      const auto = (existing ? splitTags(existing).auto : []).filter(
        (tag) => !themeHidden.includes(tag),
      );
      const tags = sanitizeTags([...auto, ...userTags]);
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
                autoThemes: auto,
                userTags,
                themeHidden: themeHidden.length > 0 ? themeHidden : undefined,
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
            autoThemes: auto,
            userTags,
            themeHidden: themeHidden.length > 0 ? themeHidden : undefined,
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

  const saveBacklog = useCallback(
    (
      key: string,
      backlog: BacklogItem[],
      backlogStamp: string,
      backlogSource: BacklogSource,
      backlogHidden: string[] = [],
    ) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      const next: WeekPrep = existing
        ? { ...existing, updatedAt: now, backlog, backlogStamp, backlogSource, backlogHidden }
        : {
            weekKey: key,
            talkNotes: "",
            updatedAt: now,
            backlog,
            backlogStamp,
            backlogSource,
            backlogHidden,
          };
      const weekPreps = existing
        ? current.weekPreps.map((prep) => (prep.weekKey === key ? next : prep))
        : [...current.weekPreps, next];
      return persist({ ...current, weekPreps });
    },
    [persist],
  );

  const saveThemes = useCallback(
    (
      updates: { id: string; updatedAt: string; themes: string[] }[],
      key: string,
      themeStamp: string,
      themeSource: "model" | "rules",
    ) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const byId = new Map(updates.map((item) => [item.id, item]));
      const entries = current.entries.map((entry) => {
        const update = byId.get(entry.id);
        if (!update || update.updatedAt !== entry.updatedAt) return entry;
        return applyThemePass(entry, update.themes);
      });
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      const next: WeekPrep = existing
        ? { ...existing, updatedAt: now, themeStamp, themeSource }
        : { weekKey: key, talkNotes: "", updatedAt: now, themeStamp, themeSource };
      const weekPreps = existing
        ? current.weekPreps.map((prep) => (prep.weekKey === key ? next : prep))
        : [...current.weekPreps, next];
      return persist({ ...current, entries, weekPreps });
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

  const setThemeDiscussed = useCallback(
    (id: string, discussed: boolean) => {
      const current = storeRef.current;
      return persist({
        ...current,
        themes: discussTheme(current.themes ?? [], id, discussed),
      });
    },
    [persist],
  );

  const dismissSessionTheme = useCallback(
    (id: string) => {
      const current = storeRef.current;
      return persist({
        ...current,
        themes: dismissTheme(current.themes ?? [], id),
      });
    },
    [persist],
  );

  const addSessionTheme = useCallback(
    (title: string) => {
      const current = storeRef.current;
      return persist({
        ...current,
        themes: addManualTheme(current.themes ?? [], title, toDateKey()),
      });
    },
    [persist],
  );

  const savePattern = useCallback(
    (key: string, patternText: string, patternStamp: string) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      const next: WeekPrep = existing
        ? { ...existing, updatedAt: now, patternText, patternStamp }
        : { weekKey: key, talkNotes: "", updatedAt: now, patternText, patternStamp };
      const weekPreps = existing
        ? current.weekPreps.map((prep) => (prep.weekKey === key ? next : prep))
        : [...current.weekPreps, next];
      return persist({ ...current, weekPreps });
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
    saveBrief,
    saveBacklog,
    saveThemes,
    saveSessionPlan,
    saveNotify,
    upsertSession,
    deleteSession,
    setThemeDiscussed,
    dismissSessionTheme,
    addSessionTheme,
    savePattern,
    refreshCloud: syncFromCloud,
  };
}
