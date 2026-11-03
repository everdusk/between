"use client";

import { useLayoutEffect, useState } from "react";
import { useI18n } from "@/components/locale-provider";

export const SCHEME_KEY = "between:scheme";

export type JournalScheme = "night" | "day";

export function readScheme(): JournalScheme {
  if (typeof document === "undefined") return "night";
  return document.documentElement.getAttribute("data-scheme") === "day" ? "day" : "night";
}

export function applyScheme(scheme: JournalScheme) {
  document.documentElement.setAttribute("data-scheme", scheme);
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    /* private mode */
  }
}

export function SchemeSwitch({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [scheme, setScheme] = useState<JournalScheme>("night");

  useLayoutEffect(() => {
    const sync = () => setScheme(readScheme());
    sync();
    window.addEventListener("between-scheme", sync);
    return () => window.removeEventListener("between-scheme", sync);
  }, []);

  function choose(next: JournalScheme) {
    applyScheme(next);
    setScheme(next);
    window.dispatchEvent(new Event("between-scheme"));
  }

  return (
    <div role="group" aria-label={t("webScheme")} className={`glass inline-flex rounded-full p-1 ${className}`}>
      {(["night", "day"] as const).map((id) => {
        const on = scheme === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            className={`flex-1 rounded-full px-3 py-1.5 text-center text-xs font-extrabold tracking-wide ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => choose(id)}
          >
            {t(id === "night" ? "webNight" : "webDay")}
          </button>
        );
      })}
    </div>
  );
}
