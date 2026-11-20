"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deviceLocaleFromNavigator,
  isLocale,
  localeFromTelegram,
  localeMeta,
  resolveAppGreetingLocale,
  type LocaleId,
} from "@/lib/i18n";
import { syncLocale } from "@/lib/locale-client";
import {
  countPhrase,
  feelingLabel,
  translate,
  type MessageKey,
} from "@/lib/messages";
import type { CheckinSlot, Feeling } from "@/lib/types";

const STORAGE_KEY = "between:locale";

type I18nValue = {
  publicLanguages: boolean;
  locale: LocaleId;
  greetingLocale: LocaleId;
  setLocale: (locale: LocaleId) => void;
  t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => string;
  count: (count: number, stem: "day" | "note") => string;
  feeling: (feeling: Feeling) => string;
  slot: (slot: CheckinSlot) => string;
};

const LocaleContext = createContext<I18nValue | null>(null);

function applyDocument(locale: LocaleId) {
  const meta = localeMeta(locale);
  document.documentElement.lang = meta.intl;
  document.documentElement.dir = meta.dir;
}

export function LocaleProvider({
  telegramLanguage,
  initData = "",
  maxInitData = "",
  webAccount,
  lockLocale = null,
  publicLanguages = false,
  landing = false,
  children,
}: {
  telegramLanguage?: string | null;
  initData?: string;
  maxInitData?: string;
  webAccount?: string;
  lockLocale?: LocaleId | null;
  publicLanguages?: boolean;
  landing?: boolean;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<LocaleId>("ru");
  const storageKey = initData ? STORAGE_KEY + ":telegram" : STORAGE_KEY;
  const signedIn = Boolean(initData || maxInitData || webAccount);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  const [chosen, setChosen] = useState<LocaleId | null>(null);
  const [deviceLocale, setDeviceLocale] = useState<LocaleId>("ru");

  useLayoutEffect(() => {
    if (landing && document.documentElement.dataset.between === "app") return;
    if (lockLocale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the locked language is applied before paint
      setLocaleState(lockLocale);
      setChosen(lockLocale);
      setDeviceLocale(lockLocale);
      applyDocument(lockLocale);
      return;
    }
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    const browserLanguage = preferred.map(localeFromTelegram).find(id => id === "en" || id === "ru") ?? "en";
    const device = publicLanguages ? browserLanguage : localeFromTelegram(telegramLanguage) ?? deviceLocaleFromNavigator();
    let stored: string | null = null;
    let explicit: LocaleId | null = null;
    const linkLanguage = publicLanguages && !landing ? new URLSearchParams(location.search).get("lang") : null;
    const initial = linkLanguage === "ru" || linkLanguage === "en" ? linkLanguage : device;
    let next: LocaleId = initial;
    try {
      stored = localStorage.getItem(storageKey);
      if (isLocale(stored) && (!publicLanguages || stored === "ru" || stored === "en")) explicit = stored;
      next = explicit ?? initial;
    } catch {
      next = initial;
    }
    // Stored choice and the device language are known only on the client.
    setLocaleState(next);
    setChosen(explicit);
    setDeviceLocale(device);
    applyDocument(next);
    if (!signedIn) return;
    let active = true;
    let readId = 0;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      const id = ++readId;
      const version = revision.current;
      await writes.current;
      if (!active || version !== revision.current) return;
      try {
        const result = await syncLocale(initData, maxInitData, { device });
        if (!active || id !== readId || version !== revision.current || !isLocale(result.locale)) return;
        setLocaleState(result.locale);
        setChosen(result.locale);
        applyDocument(result.locale);
      } catch {
        // Keep the local language while the account is unavailable.
      }
    };
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [telegramLanguage, initData, maxInitData, webAccount, signedIn, lockLocale, storageKey, publicLanguages, landing]);

  const setLocale = useCallback((next: LocaleId) => {
    if (lockLocale) return;
    setLocaleState(next);
    setChosen(next);
    applyDocument(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Private mode can block storage; the choice still applies for this visit.
    }
    revision.current += 1;
    if (signedIn) {
      writes.current = writes.current.then(async () => {
        await syncLocale(initData, maxInitData, { locale: next });
      }).catch(() => undefined);
    }
  }, [initData, maxInitData, signedIn, lockLocale, storageKey]);

  const value = useMemo<I18nValue>(() => {
    const slotKey = {
      morning: "slotMorning",
      day: "slotDay",
      evening: "slotEvening",
    } as const;
    const active = lockLocale ?? locale;
    return {
      publicLanguages,
      locale: active,
      greetingLocale: lockLocale ?? resolveAppGreetingLocale(chosen, deviceLocale),
      setLocale,
      t: (key, vars) => translate(active, key, vars),
      count: (amount, stem) => countPhrase(active, amount, stem),
      feeling: (feeling) => feelingLabel(active, feeling),
      slot: (slot) => translate(active, slotKey[slot]),
    };
  }, [locale, lockLocale, chosen, deviceLocale, setLocale, publicLanguages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n outside LocaleProvider");
  return value;
}
