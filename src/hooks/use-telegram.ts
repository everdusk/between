"use client";

import { useEffect, useState } from "react";
import type { WebApp } from "@twa-dev/types";
import { markSplashVisible } from "@/lib/splash";
import {
  applyDevicePerformance,
  applyTelegramChrome,
  applyTelegramSafeArea,
  paintSplashChrome,
  splashChromeIsHeld,
  applyTelegramTheme,
  applyViewportBox,
  clearTelegramThemeOverrides,
  publishVisualViewport,
  DEV_DISPLAY_NAME,
  displayNameFromUser,
  isLikelyTelegram,
  type TelegramSession,
} from "@/lib/telegram";

const FALLBACK: TelegramSession = {
  ready: false,
  inTelegram: false,
  user: null,
  displayName: DEV_DISPLAY_NAME,
  colorScheme: "light",
  viewportStableHeight: null,
  initData: "",
};

export function useTelegram(): TelegramSession {
  const [session, setSession] = useState<TelegramSession>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    let webApp: WebApp | null = null;
    const onVisualViewport = () => publishVisualViewport();

    const onTheme = () => {
      if (!webApp || cancelled) return;
      const inTelegram = isLikelyTelegram(webApp);
      syncFromWebApp(webApp, inTelegram);
    };

    const onViewport = () => {
      if (!webApp || cancelled) return;
      applyViewportBox(webApp.viewportHeight, webApp.viewportStableHeight);
      publishVisualViewport();
      applyTelegramSafeArea(webApp.safeAreaInset, webApp.contentSafeAreaInset, {
        visible: webApp.viewportHeight,
        stable: webApp.viewportStableHeight,
      });
      setSession((prev) => ({
        ...prev,
        viewportStableHeight:
          webApp!.viewportStableHeight || webApp!.viewportHeight || null,
      }));
    };

    const onSafeArea = () => {
      if (!webApp || cancelled) return;
      applyTelegramSafeArea(webApp.safeAreaInset, webApp.contentSafeAreaInset, {
        visible: webApp.viewportHeight,
        stable: webApp.viewportStableHeight,
      });
    };

    function syncFromWebApp(wa: WebApp, inTelegram: boolean) {
      if (cancelled) return;
      const user = wa.initDataUnsafe?.user ?? null;
      if (inTelegram) {
        applyTelegramTheme(wa.themeParams, wa.colorScheme);
        if (splashChromeIsHeld()) paintSplashChrome();
        else applyTelegramChrome(wa);
        applyViewportBox(wa.viewportHeight, wa.viewportStableHeight);
        publishVisualViewport();
      } else {
        clearTelegramThemeOverrides();
      }
      setSession({
        ready: true,
        inTelegram,
        user,
        displayName: inTelegram
          ? displayNameFromUser(user)
          : DEV_DISPLAY_NAME,
        colorScheme: inTelegram ? wa.colorScheme : "light",
        viewportStableHeight: inTelegram
          ? wa.viewportStableHeight || wa.viewportHeight || null
          : null,
        initData: inTelegram ? wa.initData || "" : "",
      });
    }

    void import("@twa-dev/sdk")
      .then((mod) => {
        if (cancelled) return;
        webApp = mod.default;
        const inTelegram = isLikelyTelegram(webApp);

        applyDevicePerformance(navigator.userAgent);
        publishVisualViewport();
        window.visualViewport?.addEventListener("resize", onVisualViewport);
        window.visualViewport?.addEventListener("scroll", onVisualViewport);
        window.addEventListener("resize", onVisualViewport);
        if (inTelegram) {
          // Grow first, then reveal, so the frame is not resized in front of the user.
          webApp.expand();
          webApp.ready();
          applyTelegramSafeArea(webApp.safeAreaInset, webApp.contentSafeAreaInset, {
            visible: webApp.viewportHeight,
            stable: webApp.viewportStableHeight,
          });
        }
        // The hold starts here. Before ready(), Telegram's loader is what the user sees.
        markSplashVisible();

        syncFromWebApp(webApp, inTelegram);
        webApp.onEvent("themeChanged", onTheme);
        webApp.onEvent("viewportChanged", onViewport);
        webApp.onEvent("safeAreaChanged", onSafeArea);
        webApp.onEvent("contentSafeAreaChanged", onSafeArea);
      })
      .catch(() => {
        if (!cancelled) {
          markSplashVisible();
          clearTelegramThemeOverrides();
          setSession({
            ...FALLBACK,
            ready: true,
          });
        }
      });

    return () => {
      cancelled = true;
      window.visualViewport?.removeEventListener("resize", onVisualViewport);
      window.visualViewport?.removeEventListener("scroll", onVisualViewport);
      window.removeEventListener("resize", onVisualViewport);
      if (webApp) {
        webApp.offEvent("themeChanged", onTheme);
        webApp.offEvent("viewportChanged", onViewport);
        webApp.offEvent("safeAreaChanged", onSafeArea);
        webApp.offEvent("contentSafeAreaChanged", onSafeArea);
      }
      clearTelegramThemeOverrides();
    };
  }, []);

  return session;
}
