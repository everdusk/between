"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

export const SCHEME_KEY = "between:scheme";
export const SCHEME_PICKED_KEY = "between:scheme-picked";

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

export function schemeWasPicked(): boolean {
  try {
    return localStorage.getItem(SCHEME_PICKED_KEY) === "1";
  } catch {
    return false;
  }
}

const SCHEME_TOKENS: Record<JournalScheme, Record<string, string>> = {
  night: {
    "--background": "#060b09",
    "--foreground": "#f2f7f4",
    "--card": "rgba(255, 255, 255, 0.09)",
    "--card-foreground": "#f2f7f4",
    "--popover": "#10201a",
    "--popover-foreground": "#f2f7f4",
    "--primary": "#8ff0bc",
    "--primary-foreground": "#04130c",
    "--secondary": "rgba(255, 255, 255, 0.09)",
    "--secondary-foreground": "#f2f7f4",
    "--muted": "rgba(255, 255, 255, 0.06)",
    "--muted-foreground": "rgba(222, 238, 230, 0.64)",
    "--accent": "rgba(143, 240, 188, 0.16)",
    "--accent-foreground": "#8ff0bc",
    "--destructive": "#f9a8d4",
    "--border": "rgba(255, 255, 255, 0.12)",
    "--input": "rgba(255, 255, 255, 0.08)",
    "--ring": "#8ff0bc",
    "--ink": "#04130c",
    "--ink-foreground": "#f2f7f4",
    "--ink-muted": "rgba(222, 238, 230, 0.64)",
    "--glass-fill": "rgba(255, 255, 255, 0.09)",
    "--glass-fill-strong": "rgba(255, 255, 255, 0.14)",
    "--glass-border": "rgba(255, 255, 255, 0.14)",
    "--glass-highlight": "rgba(255, 255, 255, 0.22)",
    "--glass-shadow": "rgba(0, 0, 0, 0.45)",
    "--section-header": "rgba(222, 238, 230, 0.64)",
    "--subtitle": "rgba(222, 238, 230, 0.64)",
    "--accent-text": "#8ff0bc",
    "--link": "#8ff0bc",
    "--tg-bg-color": "#060b09",
    "--tg-text-color": "#f2f7f4",
    "--tg-hint-color": "rgba(222, 238, 230, 0.64)",
    "--tg-button-color": "#8ff0bc",
    "--tg-button-text-color": "#04130c",
  },
  day: {
    "--background": "#f4ede8",
    "--foreground": "#1c242f",
    "--card": "#ede2dc",
    "--card-foreground": "#1c242f",
    "--popover": "#faf6f3",
    "--popover-foreground": "#1c242f",
    "--primary": "#f3544e",
    "--primary-foreground": "#faf6f3",
    "--secondary": "#e7dbd4",
    "--secondary-foreground": "#1c242f",
    "--muted": "rgba(28, 36, 47, 0.06)",
    "--muted-foreground": "rgba(28, 36, 47, 0.62)",
    "--accent": "rgba(86, 136, 151, 0.16)",
    "--accent-foreground": "#568897",
    "--destructive": "#f3544e",
    "--border": "#c9bbb7",
    "--input": "rgba(28, 36, 47, 0.06)",
    "--ring": "#f3544e",
    "--ink": "#1c242f",
    "--ink-foreground": "#faf6f3",
    "--ink-muted": "rgba(250, 246, 243, 0.72)",
    "--glass-fill": "#ede2dc",
    "--glass-fill-strong": "#faf6f3",
    "--glass-border": "#c9bbb7",
    "--glass-highlight": "rgba(255, 255, 255, 0.7)",
    "--glass-shadow": "rgba(28, 36, 47, 0.12)",
    "--section-header": "#568897",
    "--subtitle": "rgba(28, 36, 47, 0.62)",
    "--accent-text": "#568897",
    "--link": "#f3544e",
    "--tg-bg-color": "#f4ede8",
    "--tg-text-color": "#1c242f",
    "--tg-hint-color": "rgba(28, 36, 47, 0.62)",
    "--tg-button-color": "#f3544e",
    "--tg-button-text-color": "#faf6f3",
  },
};

/** Telegram paints its own theme inline. A chosen day or night has to cover those variables. */
export function paintPickedScheme(scheme: JournalScheme) {
  const root = document.documentElement;
  if (root.hasAttribute("data-splash") || (root.dataset.design === "dawn" && !root.dataset.telegramTheme)) return;
  for (const [name, value] of Object.entries(SCHEME_TOKENS[scheme])) {
    root.style.setProperty(name, value);
  }
  root.style.setProperty("color-scheme", scheme === "day" ? "only light" : "only dark");
  if (!root.dataset.telegramTheme) return;
  const color = scheme === "day" ? "#f4ede8" : "#060b09";
  void import("@twa-dev/sdk").then(({ default: webApp }) => {
    try {
      webApp.setHeaderColor(color);
    } catch {
      /* Bot API older than 6.1 */
    }
    try {
      webApp.setBackgroundColor(color);
    } catch {
      /* Bot API older than 6.1 */
    }
    try {
      webApp.setBottomBarColor(color);
    } catch {
      /* Bot API older than 7.10 */
    }
  });
}

function subscribeToScheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme", "data-telegram-theme"] });
  window.addEventListener("between-scheme", notify);
  return () => {
    observer.disconnect();
    window.removeEventListener("between-scheme", notify);
  };
}

function displayScheme(): JournalScheme {
  const telegram = document.documentElement.dataset.telegramTheme;
  if (telegram && !schemeWasPicked()) return telegram === "light" ? "day" : "night";
  return readScheme();
}

function useDisplayScheme() {
  return useSyncExternalStore(subscribeToScheme, displayScheme, () => null);
}

export function useDemoMediaDirectory() {
  const scheme = useDisplayScheme();
  if (!scheme) return null;
  return scheme === "day" ? "/landing/day" : "/landing";
}

export function SchemeSwitch({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const scheme = useDisplayScheme() ?? "night";

  function choose(next: JournalScheme) {
    applyScheme(next);
    try {
      localStorage.setItem(SCHEME_PICKED_KEY, "1");
    } catch {
      /* private mode */
    }
    if (document.documentElement.dataset.telegramTheme) paintPickedScheme(next);
    window.dispatchEvent(new Event("between-scheme"));
  }

  const next = scheme === "night" ? "day" : "night";
  const label = `${t("webScheme")} · ${t(next === "day" ? "webDay" : "webNight")}`;
  const Icon = next === "day" ? Sun : Moon;
  return (
    <button type="button" className={`glass-chrome preference-control preference-icon ${className}`} aria-label={label} title={label} onClick={() => choose(next)}>
      <Icon size={20} aria-hidden />
    </button>
  );
}
