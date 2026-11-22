"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { applyIntro, type IntroDraft } from "@/lib/intro-record";
import { createId, toDateKey, weekKey } from "@/lib/dates";
import { isFeeling } from "@/lib/feelings";
import { fetchJournal, mergeStores, putJournal, requestBrief, tombstoneIds } from "@/lib/journal-api";

const EMPTY_JUDGE_SKIPS: string[] = [];
import type { LocaleId } from "@/lib/i18n";
import { entryInWindow, observationWindow } from "@/lib/session-summary";
import {
  addManualTheme,
  applyVerdict,
  dedupFacts,
  fallbackVerdict,
  discussTheme,
  dismissTheme,
  judgeFacts,
  mergeThemes,
  judgeStamp,
  modelRequestStamp,
  parseDedupHit,
  parseJudgeVerdict,
  pendingJudgeEntries,
  themesForJudge,
} from "@/lib/themes";
import { applyThemePass, isTherapyTheme, sanitizeTags, splitTags } from "@/lib/tags";
import { clearStore, loadStore, saveStore, WEB_STORAGE_KEY } from "@/lib/storage";
import {
  emptyStore,
  type Feeling,
  type JournalEntry,
  type NotifyPrefs,
  type SessionNote,
  type SessionTheme,
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
  /** Signed MAX launch string. Names the chat's journal even when a website cookie is set. */
  maxInitData?: string;
  inTelegram?: boolean;
  locale?: LocaleId;
  web?: boolean;
}) {
  const initData = options?.initData ?? "";
  const maxInitData = options?.maxInitData ?? "";
  const inTelegram = Boolean(options?.inTelegram && initData);
  const web = Boolean(options?.web) || Boolean(maxInitData);
  const cloud = inTelegram || web;
  const storageKey = web ? WEB_STORAGE_KEY : undefined;
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
  const maxInitRef = useRef(maxInitData);
  const cloudRef = useRef(cloud);
  const storageKeyRef = useRef(storageKey);
  const cacheId = useRef("");
  const syncEpoch = useRef(0);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);
  useEffect(() => {
    initDataRef.current = initData;
    maxInitRef.current = maxInitData;
    cloudRef.current = cloud;
    storageKeyRef.current = storageKey;
    cacheId.current = "";
    syncEpoch.current++;
  }, [initData, maxInitData, cloud, storageKey]);

  const applyLocal = useCallback((next: TherapyStore) => {
    const result = saveStore(next, storageKeyRef.current);
    if (result.ok) {
      storeRef.current = result.data;
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
    if (!cloudRef.current) return;
    const epoch = ++syncEpoch.current;
    const data = initDataRef.current;
    const maxData = maxInitRef.current;
    const remote = await fetchJournal(data, maxData);
    if (epoch !== syncEpoch.current) return;
    if (!remote.ok) {
      setSyncLabel("offline-cloud");
      if (!cacheId.current || remote.status === 401) {
        cacheId.current = "";
        setStatus("error");
        setError("cloud_unavailable");
      }
      return;
    }
    cacheId.current = remote.cacheId;
    storageKeyRef.current = `between:journal:${remote.cacheId}`;
    const local = loadStore(storageKeyRef.current);
    const localStore = local.ok ? local.data : emptyStore();
    const merged = mergeStores(localStore, remote.store);
    applyLocal(merged);
    setSyncLabel("cloud");
    const tz = deviceTimeZone();
    void putJournal(data, merged, tz, undefined, maxData,remote.cacheId);
  }, [applyLocal]);

  useEffect(() => {
    if (!hydrated) return;
    if (cloud) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- wait for the authenticated cache namespace
      setStatus("loading");
      void syncFromCloud();
      return;
    }
    const result = loadStore(storageKey);
    if (result.ok) {
      // Local journal is only available after mount.
      setStore(result.data);
      setError(null);
      if (!cloud) {
        setStatus("ready");
        setSyncLabel("local");
      }
    } else {
      setStatus("error");
      setError(result.error);
      return;
    }

  }, [hydrated, cloud, storageKey, syncFromCloud]);

  useEffect(() => {
    if (!cloud) return;
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
  }, [cloud, syncFromCloud]);

  const persist = useCallback(
    (
      next: TherapyStore,
      options?: { dropEntryIds?: string[]; dropSessionIds?: string[]; replace?: boolean },
    ) => {
      const ok = applyLocal(next);
      if (!ok) return false;
      if (cloudRef.current) {
        const tz = deviceTimeZone();
        void putJournal(initDataRef.current, next, tz, options, maxInitRef.current,cacheId.current).then((cloudOk) => {
          setSyncLabel(cloudOk ? "cloud" : "offline-cloud");
        });
      }
      return true;
    },
    [applyLocal],
  );

  const importIntroduction = useCallback(async (record: IntroDraft) => {
    const owner = cacheId.current;
    if (!owner || !cloudRef.current) return false;
    const imported = applyIntro(storeRef.current, record);
    const saved = await putJournal(initDataRef.current, imported, deviceTimeZone(), undefined, maxInitRef.current, owner);
    if (!saved || cacheId.current !== owner) return false;
    return applyLocal(mergeStores(storeRef.current, imported));
  }, [applyLocal]);

  const judgeRun = useRef<string | null>(null);
  const judgeTries = useRef<Record<string, number>>({});
  const judgeTimer = useRef<number | null>(null);
  const judgeAlive = useRef(true);
  const [judgeNudge, setJudgeNudge] = useState(0);
  useEffect(() => {
    judgeAlive.current = true;
    return () => {
      judgeAlive.current = false;
      if (judgeTimer.current !== null) {
        window.clearTimeout(judgeTimer.current);
        judgeTimer.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!hydrated || !cloud) return;
    const now = new Date();
    const today = toDateKey(now);
    const period = observationWindow(store.sessions, store.entries, today, now, store.profile?.therapy === false ? null : store.sessionPlan);
    const pending = pendingJudgeEntries(
      store.entries.filter((entry) => entryInWindow(entry, period)),
      store.judgeSettled ?? [],
      period.days,
    );
    const entry = pending[0];
    if (!entry) return;
    const stamp = judgeStamp(entry);
    if (judgeRun.current === stamp) return;
    judgeRun.current = stamp;
    void (async () => {
      const facts = judgeFacts(themesForJudge(storeRef.current.themes ?? []), entry);
      const result = await requestBrief(
        initData,
        facts,
        modelRequestStamp("j", stamp),
        locale,
        "judge",
        maxInitData,
      );
      if (!judgeAlive.current || judgeRun.current !== stamp) return;
      let verdict = result.ok && result.text ? parseJudgeVerdict(result.text) : null;
      const fromModel = Boolean(verdict);
      if (!verdict) {
        const reason = result.ok ? (result.reason ?? "") : result.error;
        const tries = (judgeTries.current[stamp] ?? 0) + 1;
        judgeTries.current[stamp] = tries;
        const retry =
          tries < 2 && (reason === "network" || reason.startsWith("model_failed"));
        if (retry && judgeAlive.current) {
          judgeRun.current = null;
          if (judgeTimer.current !== null) window.clearTimeout(judgeTimer.current);
          judgeTimer.current = window.setTimeout(() => {
            judgeTimer.current = null;
            setJudgeNudge((n) => n + 1);
          }, 8000);
          return;
        }
        verdict = fallbackVerdict(entry);
      }
      const snapshot = storeRef.current;
      const applied = applyVerdict(
        { themes: snapshot.themes, links: snapshot.themeLinks },
        entry,
        verdict,
      );
      let state = applied.state;
      let focus = fromModel ? applied.touchedId : null;
      for (let pass = 0; pass < 2 && focus; pass += 1) {
        const theme = state.themes.find(
          (item) => item.id === focus && item.status === "active" && !item.dismissed,
        );
        const others = state.themes.filter(
          (item) => item.id !== focus && item.status === "active" && !item.dismissed,
        );
        if (!theme || theme.manual || others.length === 0) break;
        const dedup = await requestBrief(
          initData,
          dedupFacts(theme, others),
          modelRequestStamp("d", stamp, pass),
          locale,
          "dedup",
          maxInitData,
        );
        if (!judgeAlive.current || judgeRun.current !== stamp) return;
        const hit = dedup.ok && dedup.text ? parseDedupHit(dedup.text) : null;
        if (!hit || hit.confidence < 0.85 || hit.themeId === focus) break;
        state = mergeThemes(state, hit.themeId, focus, hit.title);
        focus = hit.themeId;
      }
      if (!judgeAlive.current || judgeRun.current !== stamp) return;
      const latest = storeRef.current;
      judgeRun.current = null;
      if (latest.judgeSettled.includes(stamp)) return;
      if (latest.themes !== snapshot.themes || latest.themeLinks !== snapshot.themeLinks) {
        // A sync or edit landed during deduplication. Keep the newer topic list.
        state = applyVerdict({ themes: latest.themes, links: latest.themeLinks }, entry, verdict).state;
      }
      persist({
        ...latest,
        themes: state.themes,
        themeLinks: state.links,
        judgeSettled: [...new Set([...(latest.judgeSettled ?? []), stamp])].slice(-400),
      });
    })();
  }, [hydrated, cloud, initData, maxInitData, judgeNudge, locale, persist, store.entries, store.judgeSettled, store.sessionPlan, store.sessions, store.profile?.therapy]);

  const resetCorrupted = useCallback(() => {
    const result = clearStore(storageKeyRef.current);
    if (result.ok) {
      setStore(result.data);
      setStatus("ready");
      setError(null);
      if (cloudRef.current) {
        void putJournal(initDataRef.current, result.data, deviceTimeZone(), { replace: true }, maxInitRef.current,cacheId.current);
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
            id: input.id ?? createId(),
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
      return persist(
        {
          ...current,
          entries: current.entries.filter((entry) => entry.id !== id),
          droppedEntryIds: tombstoneIds(current.droppedEntryIds, id),
        },
        { dropEntryIds: [id] },
      );
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
    (input: Omit<NotifyPrefs, "updatedAt">) => {
      const current = storeRef.current;
      return persist({
        ...current,
        notify: { ...current.notify, ...input, updatedAt: new Date().toISOString() },
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
    (id: string, discussed: boolean, outcome?: string) => {
      const current = storeRef.current;
      return persist({
        ...current,
        themes: discussTheme(current.themes ?? [], id, discussed).map(theme => theme.id === id && outcome?.trim() ? { ...theme, outcome: outcome.trim() } : theme),
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
        themes: addManualTheme(current.themes, title, toDateKey()),
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
      return persist(
        {
          ...current,
          sessions: current.sessions.filter((session) => session.id !== id),
          droppedSessionIds: tombstoneIds(current.droppedSessionIds, id),
        },
        { dropSessionIds: [id] },
      );
    },
    [persist],
  );

  return {
    store,
    importIntroduction,
    saveProfile(therapy: boolean) {
      const store = storeRef.current;
      return persist({ ...store, profile: { ...store.profile, therapy, updatedAt: new Date().toISOString() } });
    },
    restoreTheme(id: string, status: SessionTheme["status"]) {
      const current = storeRef.current;
      return persist({ ...current, themes: current.themes.map(theme => theme.id === id ? { ...theme, status, dismissed: false, updatedAt: new Date().toISOString() } : theme) });
    },
    setObservation(id:string, response?:SessionTheme["observation"]) {
      const current=storeRef.current;
      return persist({...current,themes:current.themes.map(theme=>theme.id===id ? {...theme, observation:response,updatedAt:new Date().toISOString()} : theme)});
    },
    saveReflection(id: string, reflection: NonNullable<JournalEntry["reflection"]>, topic: boolean) {
      const current = storeRef.current;
      const entry = current.entries.find(note => note.id === id);
      if (!entry) return false;
      const updatedAt = new Date().toISOString();
      const entries = current.entries.map(note => note.id === id ? { ...note, reflection, updatedAt } : note);
      const themes = topic ? addManualTheme(current.themes, reflection.insight || reflection.answer, toDateKey(), updatedAt) : current.themes;
      const linkedThemes = topic ? themes.map((theme,index) => index === current.themes.length
        ? { ...theme, quotes: [{ entryId: id, date: entry.date, text: entry.body, intensity: 0 }] }
        : theme) : themes;
      return persist({ ...current, entries, themes: linkedThemes });
    },
    status: hydrated ? status : "loading",
    error,
    syncLabel,
    resetCorrupted,
    retryCloud: syncFromCloud,
    clearCache: () => clearStore(storageKeyRef.current),
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
    judgeSkipped: EMPTY_JUDGE_SKIPS,
    refreshCloud: syncFromCloud,
  };
}
