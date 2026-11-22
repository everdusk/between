"use client";

import { useEffect } from "react";
import { messengerChoice, SCHEME_EVENT } from "@/lib/messenger-scheme";

/** MAX exposes the WebView's light/dark media preference, without Telegram-style palette tokens. */
export function useMaxScheme(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function sync() {
      const choice = messengerChoice("max");
      document.documentElement.dataset.scheme = choice === "client" ? (media.matches ? "night" : "day") : choice;
    }
    sync();
    media.addEventListener("change", sync);
    window.addEventListener(SCHEME_EVENT, sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(SCHEME_EVENT, sync);
    };
  }, [active]);
}
