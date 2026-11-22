"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { TherapyApp } from "@/components/therapy-app";
import { WeekPriceProvider } from "@/components/week-prices";
import { holdAppSurface, requestsBrowserJournal, surfaceFromLocation } from "@/lib/landing";
import "./web-theme.css";
import "./web-workspace.css";

/** A separate browser entry. The messenger entry at /journal keeps its UI. */
type Prices = { starPrice: number; rubPrice: number };

function subscribeLaunch(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

function opensDiary() {
  if (requestsBrowserJournal(location.search)) return true;
  let stored: string | null = null;
  try { stored = sessionStorage.getItem("__telegram__initParams"); } catch { /* private browsing */ }
  return surfaceFromLocation(location.hash, location.search, stored) === "app";
}

export function WebApp(props: Prices) {
  const open = useSyncExternalStore(subscribeLaunch, opensDiary, () => false);
  return open ? <BrowserJournal {...props} /> : null;
}

function BrowserJournal({ starPrice, rubPrice }: Prices) {
  useLayoutEffect(() => {
    holdAppSurface();
    document.documentElement.setAttribute("data-journal", "web");
    let scheme = document.documentElement.dataset.telegramTheme === "dark" ? "night" : "day";
    try {
      const saved = localStorage.getItem("between:scheme");
      if (saved === "day" || saved === "night") scheme = saved;
    } catch { /* private mode */ }
    document.documentElement.setAttribute("data-scheme", scheme);
    return () => {
      document.documentElement.removeAttribute("data-journal");
      document.documentElement.removeAttribute("data-scheme");
    };
  }, []);
  return <WeekPriceProvider starPrice={starPrice} rubPrice={rubPrice}><TherapyApp webFirst /></WeekPriceProvider>;
}
