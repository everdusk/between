"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
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
  children,
}: {
  telegramLanguage?: string | null;
  initData?: string;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<LocaleId>("ru");
  const [chosen, setChosen] = useState<LocaleId | null>(null);
  const [deviceLocale, setDeviceLocale] = useState<LocaleId>("ru");

  useLayoutEffect(() => {
    const device = deviceLocaleFromNavigator();
    let stored: string | null = null;
    let explicit: LocaleId | null = null;
    let next: LocaleId = "ru";
    try {
      stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) explicit = stored;
      next = explicit ?? localeFromTelegram(telegramLanguage) ?? "ru";
    } catch {
      next = localeFromTelegram(telegramLanguage) ?? "ru";
    }
    // Stored choice and the device language are known only on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- apply before paint so the first frame matches the saved language
    setLocaleState(next);
    setChosen(explicit);
    setDeviceLocale(device);
    applyDocument(next);
    syncLocale(initData, {
      device,
      ...(isLocale(stored) ? { locale: stored } : {}),
    });
  }, [telegramLanguage, initData]);

  const setLocale = useCallback((next: LocaleId) => {
    setLocaleState(next);
    setChosen(next);
    applyDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode can block storage; the choice still applies for this visit.
    }
    syncLocale(initData, { locale: next });
  }, [initData]);

  const value = useMemo<I18nValue>(() => {
    const slotKey = {
      morning: "slotMorning",
      day: "slotDay",
      evening: "slotEvening",
    } as const;
    return {
      locale,
      greetingLocale: resolveAppGreetingLocale(chosen, deviceLocale),
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      count: (amount, stem) => countPhrase(locale, amount, stem),
      feeling: (feeling) => feelingLabel(locale, feeling),
      slot: (slot) => translate(locale, slotKey[slot]),
    };
  }, [locale, chosen, deviceLocale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n outside LocaleProvider");
  return value;
}
