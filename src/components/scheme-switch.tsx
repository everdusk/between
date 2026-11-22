"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/locale-provider";

import { chooseMessengerScheme, messengerChoice, type Messenger } from "@/lib/messenger-scheme";

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

function subscribeToScheme(notify: () => void) {
  const observer = new MutationObserver(notify);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme", "data-telegram-theme"] });
  window.addEventListener("between-scheme", notify);
  return () => {
    observer.disconnect();
    window.removeEventListener("between-scheme", notify);
  };
}

function useDisplayScheme() {
  return useSyncExternalStore(subscribeToScheme, readScheme, () => null);
}

export function useDemoMediaDirectory() {
  const scheme = useDisplayScheme();
  if (!scheme) return null;
  return scheme === "day" ? "/landing/day" : "/landing";
}

export function SchemeSwitch({ className = "", host }: { className?: string; host?: Messenger }) {
  const { t } = useI18n();
  const scheme = useDisplayScheme() ?? "night";

  const choice = useSyncExternalStore(subscribeToScheme, () => host ? messengerChoice(host) : null, () => null);
  if (host) return (
    <div role="group" aria-label={t("webScheme")} className="messenger-schemes">
      {(["day", "night", "client"] as const).map(mode => (
        <button key={mode} type="button" className="glass-chrome preference-control" aria-pressed={choice === mode}
          onClick={() => chooseMessengerScheme(host, mode)}>
          {t(mode === "client" ? "myTheme" : mode === "day" ? "webDay" : "webNight")}
        </button>
      ))}
    </div>
  );
  const next = scheme === "night" ? "day" : "night";
  const label = `${t("webScheme")} · ${t(next === "day" ? "webDay" : "webNight")}`;
  const Icon = next === "day" ? Sun : Moon;
  return (
    <button type="button" className={`glass-chrome preference-control preference-icon ${className}`} aria-label={label} title={label} onClick={() => applyScheme(next)}>
      <Icon size={20} aria-hidden />
    </button>
  );
}
