"use client";

import { useEffect, useState } from "react";
import type { WebApp } from "@twa-dev/types";
import {
  applyTelegramTheme,
  applyViewportHeight,
  clearTelegramThemeOverrides,
  DEV_DISPLAY_NAME,
  displayNameFromUser,
  isLikelyTelegram,
  isLocalDevHost,
  type TelegramSession,
} from "@/lib/telegram";

const FALLBACK: TelegramSession = {
  ready: false,
  inTelegram: false,
  isLocalHost: false,
  user: null,
  displayName: DEV_DISPLAY_NAME,
  colorScheme: "light",
  viewportStableHeight: null,
};

export function useTelegram(): TelegramSession {
  const [session, setSession] = useState<TelegramSession>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    let webApp: WebApp | null = null;

    const onTheme = () => {
      if (!webApp || cancelled) return;
      const inTelegram = isLikelyTelegram(webApp);
      syncFromWebApp(webApp, inTelegram);
    };

    const onViewport = () => {
      if (!webApp || cancelled) return;
      applyViewportHeight(
        webApp.viewportStableHeight || webApp.viewportHeight,
      );
      setSession((prev) => ({
        ...prev,
        viewportStableHeight:
          webApp!.viewportStableHeight || webApp!.viewportHeight || null,
      }));
    };

    function syncFromWebApp(wa: WebApp, inTelegram: boolean) {
      if (cancelled) return;
      const user = wa.initDataUnsafe?.user ?? null;
      const isLocalHost = isLocalDevHost();
      if (inTelegram) {
        applyTelegramTheme(wa.themeParams, wa.colorScheme);
        applyViewportHeight(wa.viewportStableHeight || wa.viewportHeight);
      } else {
        clearTelegramThemeOverrides();
      }
      setSession({
        ready: true,
        inTelegram,
        isLocalHost,
        user,
        displayName: inTelegram
          ? displayNameFromUser(user)
          : DEV_DISPLAY_NAME,
        colorScheme: inTelegram ? wa.colorScheme : "light",
        viewportStableHeight: inTelegram
          ? wa.viewportStableHeight || wa.viewportHeight || null
          : null,
      });
    }

    void import("@twa-dev/sdk")
      .then((mod) => {
        if (cancelled) return;
        webApp = mod.default;
        const inTelegram = isLikelyTelegram(webApp);

        if (inTelegram) {
          webApp.ready();
          webApp.expand();
          try {
            webApp.setHeaderColor("bg_color");
            webApp.setBackgroundColor("bg_color");
          } catch {
            // Older clients may not support header/background colors
          }
        }

        syncFromWebApp(webApp, inTelegram);
        webApp.onEvent("themeChanged", onTheme);
        webApp.onEvent("viewportChanged", onViewport);
      })
      .catch(() => {
        if (!cancelled) {
          clearTelegramThemeOverrides();
          setSession({
            ...FALLBACK,
            ready: true,
            isLocalHost: isLocalDevHost(),
          });
        }
      });

    return () => {
      cancelled = true;
      if (webApp) {
        webApp.offEvent("themeChanged", onTheme);
        webApp.offEvent("viewportChanged", onViewport);
      }
      clearTelegramThemeOverrides();
    };
  }, []);

  return session;
}
