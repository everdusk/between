"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { countPhrase, feelingLabel, translate, type MessageKey } from "@/lib/messages";
import type { CheckinSlot, Feeling } from "@/lib/types";

const slotKeys = { morning: "slotMorning", day: "slotDay", evening: "slotEvening" } as const;
type Language = "ru" | "en";
const storageKey = "between:locale:telegram";

function strings(locale: Language) {
  return {
    locale,
    t: (key: MessageKey, vars?: Record<string, string | number | undefined>) => translate(locale, key, vars),
    count: (amount: number, stem: "day" | "note") => countPhrase(locale, amount, stem),
    feeling: (feeling: Feeling) => feelingLabel(locale, feeling),
    slot: (slot: CheckinSlot) => translate(locale, slotKeys[slot]),
  };
}

const LocaleContext = createContext<ReturnType<typeof strings> & { chooseLanguage?: (value: Language) => void }>(strings("ru"));

function supported(value: unknown): value is Language {
  return value === "en" || value === "ru";
}

async function sync(initData: string, body: { device: Language } | { locale: Language }) {
  const response = await fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  return (await response.json()).locale as unknown;
}

export function TelegramLocaleProvider({ languageCode, initData, children }: {
  languageCode?: string;
  initData: string;
  children: ReactNode;
}) {
  const device = /^en(?:-|$)/i.test(languageCode || navigator.language) ? "en" : "ru";
  const [selected, setSelected] = useState<Language | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return supported(saved) ? saved : null;
    } catch { return null; }
  });
  const locale = selected ?? device;
  const edited = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    if (!initData) return;
    let active = true;
    void sync(initData, { device }).then(saved => {
      if (active && !edited.current && supported(saved)) {
        setSelected(saved);
        try { localStorage.setItem(storageKey, saved); } catch { /* Storage can be unavailable. */ }
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [device, initData]);

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = "ru"; };
  }, [locale]);

  const chooseLanguage = useCallback((next: Language) => {
    edited.current = true;
    setSelected(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Apply for this session. */ }
    if (initData) {
      writes.current = writes.current.then(async () => { await sync(initData, { locale: next }); }).catch(() => undefined);
    }
  }, [initData]);
  const value = useMemo(() => ({ ...strings(locale), chooseLanguage }), [locale, chooseLanguage]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
