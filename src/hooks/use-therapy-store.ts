"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { archivedForEntry, applyReviewVerdict, recordReview, type ReviewEvent } from "@/lib/theme-review";
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
  dedupComparison,
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
} from "@/lib/themes";
import { applyThemePass, isTherapyTheme, sanitizeTags, splitTags } from "@/lib/tags";
import { clearStore, loadStore, saveStore, GUEST_STORAGE_KEY, WEB_STORAGE_KEY } from "@/lib/storage";
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
  guestStorage?: boolean;
}) {
  const initData = options?.initData ?? "";
  const maxInitData = options?.maxInitData ?? "";
  const inTelegram = Boolean(options?.inTelegram && initData);
  const web = Boolean(options?.web) || Boolean(maxInitData);
  const cloud = inTelegram || web;
  const storageKey = web ? WEB_STORAGE_KEY : options?.guestStorage && !inTelegram ? GUEST_STORAGE_KEY : undefined;
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
  const [pilotSession, setPilotSession] = useState<{cache:string;telegram:string;max:string} | null>(null);
  const reviewPilot = cloud && status === "ready" && pilotSession?.telegram === initData && pilotSession.max === maxInitData;
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
    const key = storageKeyRef.current;
    if (key === GUEST_STORAGE_KEY) {
      const latest = loadStore(key);
      if (!latest.ok) return false;
      // An open guest tab can outlive a successful transfer in another tab.
      if (storeRef.current.introductions?.length && !latest.data.introductions?.length) return false;
      next = mergeStores(latest.data, next);
    }
    const result = saveStore(next, key);
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
    setPilotSession(remote.reviewPilot ? {cache:remote.cacheId,telegram:data,max:maxData} : null);
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
      storeRef.current = result.data;
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

  useEffect(() => {
    if (cloud || storageKey !== GUEST_STORAGE_KEY) return;
    function refresh(event: StorageEvent) {
      if (event.key !== GUEST_STORAGE_KEY && event.key !== null) return;
      const latest = loadStore(GUEST_STORAGE_KEY);
      if (latest.ok) { storeRef.current = latest.data; setStore(latest.data); }
    }
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [cloud, storageKey]);

  const startGuest = useCallback((record: IntroDraft) => {
    if (cloudRef.current || storageKeyRef.current !== GUEST_STORAGE_KEY) return false;
    return applyLocal(applyIntro(storeRef.current, record));
  }, [applyLocal]);

  const importIntroduction = useCallback(async (record: IntroDraft, fromGuest = false) => {
    const owner = cacheId.current;
    if (!owner || !cloudRef.current) return false;
    const guest = fromGuest ? loadStore(GUEST_STORAGE_KEY) : null;
    if (guest && !guest.ok) return false;
    const snapshot = guest?.ok ? guest.data : null;
    const bindingKey = GUEST_STORAGE_KEY + ":owner:" + record.attempt;
    if (fromGuest) {
      if (!snapshot?.introductions?.some(item => item.attempt === record.attempt)) {
        return Boolean(storeRef.current.introductions?.some(item => item.attempt === record.attempt));
      }
      try {
        const bound = localStorage.getItem(bindingKey);
        if (bound && bound !== owner) return false;
        localStorage.setItem(bindingKey, owner);
      } catch { return false; }
    }
    const imported = snapshot ? mergeStores(snapshot, storeRef.current) : applyIntro(storeRef.current, record);
    if (snapshot && storeRef.current.profile) imported.profile = storeRef.current.profile;
    const saved = await putJournal(initDataRef.current, imported, deviceTimeZone(), undefined, maxInitRef.current, owner);
    if (!saved || cacheId.current !== owner) return false;
    if (!applyLocal(mergeStores(storeRef.current, imported))) return false;
    if (snapshot) {
      const latest = loadStore(GUEST_STORAGE_KEY);
      // Retry any edits made in another tab during the upload.
      if (!latest.ok || JSON.stringify(latest.data) !== JSON.stringify(snapshot)) return false;
      if (!clearStore(GUEST_STORAGE_KEY).ok) return false;
      try { localStorage.removeItem(bindingKey); } catch { /* Entries were already transferred. */ }
    }
    return true;
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
    if (!hydrated || !cloud || status !== "ready" || syncLabel !== "cloud" || !cacheId.current) return;
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
      const journal = cacheId.current;
      const apply = reviewPilot ? applyReviewVerdict : applyVerdict;
      const topics = storeRef.current.themes ?? [];
      const archives = reviewPilot ? topics.filter(t=>archivedForEntry(t,entry)) : [];
      const facts = judgeFacts(topics, entry, archives);
      const result = await requestBrief(
        initData,
        facts,
        modelRequestStamp("j", stamp, 0, facts),
        locale,
        archives.length ? "reviewJudge" : "judge",
        maxInitData,
      );
      if (!judgeAlive.current || judgeRun.current !== stamp || cacheId.current !== journal) return;
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
      const applied = apply(
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
        if (!theme || theme.manual) break;
        const comparison = dedupComparison(theme, state);
        if (comparison.candidates.length === 0) break;
        const dedup = await requestBrief(
          initData,
          comparison.facts,
          modelRequestStamp("d", stamp, pass, comparison.facts),
          locale,
          "dedup",
          maxInitData,
        );
        if (!judgeAlive.current || judgeRun.current !== stamp || cacheId.current !== journal) return;
        const hit = dedup.ok && dedup.text ? parseDedupHit(dedup.text) : null;
        if (!hit || hit.confidence < 0.85 || !comparison.candidates.some((candidate) => candidate.id === hit.themeId)) break;
        state = mergeThemes(state, hit.themeId, focus, hit.title);
        focus = hit.themeId;
      }
      if (!judgeAlive.current || judgeRun.current !== stamp || cacheId.current !== journal) return;
      const latest = storeRef.current;
      judgeRun.current = null;
      const currentEntry = latest.entries.find((item) => item.id === entry.id);
      if (!currentEntry || judgeStamp(currentEntry) !== stamp || latest.judgeSettled.includes(stamp)) return;
      if (latest.themes !== snapshot.themes || latest.themeLinks !== snapshot.themeLinks) {
        // A sync or edit landed during deduplication. Keep the newer topic list.
        state = apply({ themes: latest.themes, links: latest.themeLinks }, entry, verdict).state;
      }
      persist({
        ...latest,
        themes: state.themes,
        themeLinks: state.links,
        judgeSettled: [...new Set([...(latest.judgeSettled ?? []), stamp])].slice(-400),
      });
    })();
  }, [hydrated, cloud, status, syncLabel, reviewPilot, initData, maxInitData, judgeNudge, locale, persist, store.entries, store.judgeSettled, store.sessionPlan, store.sessions, store.profile?.therapy]);

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
    (key: string, patternText: string, patternStamp: string, pilot = false) => {
      const now = new Date().toISOString();
      const current = storeRef.current;
      const existing = current.weekPreps.find((prep) => prep.weekKey === key);
      const fields = pilot ? {reviewSummary:{stamp:patternStamp,text:patternText}} : {patternText,patternStamp};
      const next: WeekPrep = {...(existing ?? {weekKey:key,talkNotes:""}),updatedAt:now,...fields};
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
    startGuest,
    saveProfile(therapy: boolean) {
      const store = storeRef.current;
      return persist({ ...store, profile: { ...store.profile, therapy, updatedAt: new Date().toISOString() } });
    },
    restoreTheme(id: string, status: SessionTheme["status"]) {
      const current = storeRef.current;
      return persist({ ...current, themes: current.themes.map(theme => theme.id === id ? { ...theme, status, dismissed: false, updatedAt: new Date().toISOString() } : theme) });
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
    reviewPilot,
    saveReview(id:string,event:ReviewEvent) {
      if (!reviewPilot || cacheId.current !== pilotSession?.cache) return false;
      const current=storeRef.current;
      const theme=current.themes.find(t=>t.id===id);
      if (!theme) return false;
      const next=recordReview(theme,event);
      if(next===theme) return false;
      return persist({...current,themes:current.themes.map(t=>t===theme?next:t)});
    },
    judgeSkipped: EMPTY_JUDGE_SKIPS,
    refreshCloud: syncFromCloud,
  };
}
