"use client";

import { useEffect, useState } from "react";
import type { WebApp } from "@twa-dev/types";
import {
  markSplashVisible,
  SPLASH_VIEWPORT_WAIT_MS,
  splashShouldWaitForViewport,
  splashViewportSettled,
} from "@/lib/splash";
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
        // Variables can update under the frame. Native chrome and color-scheme
        // wait until it leaves: each of those repaints the iOS WebView.
        applyTelegramTheme(wa.themeParams, wa.colorScheme, {
          scheme: !splashChromeIsHeld(),
        });
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

    let revealed = false;
    let viewportCap = 0;
    let revealViewport: ((params: { isStateStable: boolean }) => void) | null = null;

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
          const reveal = () => {
            if (revealed || cancelled || !webApp) return;
            revealed = true;
            window.clearTimeout(viewportCap);
            if (revealViewport) {
              webApp.offEvent("viewportChanged", revealViewport);
              revealViewport = null;
            }
            // The hold starts at ready(). Until then Telegram's loader covers the page.
            webApp.ready();
            markSplashVisible();
          };
          const waitForViewport = splashShouldWaitForViewport(webApp.platform);
          if (!waitForViewport) {
            revealViewport = (params) => {
              if (!webApp) return;
              const settled = splashViewportSettled({
                expanded: webApp.isExpanded,
                viewportHeight: webApp.viewportHeight,
                stableHeight: webApp.viewportStableHeight,
              });
              // A stable event while still collapsed is the size before expand().
              const stableAndOpen = params?.isStateStable !== false && webApp.isExpanded;
              if (!settled && !stableAndOpen) return;
              reveal();
            };
            // Listen before expand(), so a sync resize is not missed.
            webApp.onEvent("viewportChanged", revealViewport);
          }
          webApp.expand();
          paintSplashChrome();
          applyTelegramSafeArea(webApp.safeAreaInset, webApp.contentSafeAreaInset, {
            visible: webApp.viewportHeight,
            stable: webApp.viewportStableHeight,
          });
          if (
            !waitForViewport &&
            splashViewportSettled({
              expanded: webApp.isExpanded,
              viewportHeight: webApp.viewportHeight,
              stableHeight: webApp.viewportStableHeight,
            })
          ) {
            reveal();
          } else {
            // iOS marks the window stable on the first resize, mid-animation.
            // The loader stays up for the whole wait, then the frame appears at full size.
            viewportCap = window.setTimeout(reveal, SPLASH_VIEWPORT_WAIT_MS);
          }
        } else {
          markSplashVisible();
        }

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
      window.clearTimeout(viewportCap);
      window.visualViewport?.removeEventListener("resize", onVisualViewport);
      window.visualViewport?.removeEventListener("scroll", onVisualViewport);
      window.removeEventListener("resize", onVisualViewport);
      if (webApp) {
        if (revealViewport) webApp.offEvent("viewportChanged", revealViewport);
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
