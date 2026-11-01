"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import {
  SPLASH_MAX_MS,
  SPLASH_READY_EVENT,
  SPLASH_VISIBLE_EVENT,
  dismissSplash,
  markSplashVisible,
  splashAppIsReady,
  splashIsDismissed,
  splashRemainMs,
  splashVisibleElapsed,
} from "@/lib/splash";
import { releaseSplashChrome, SPLASH_CHROME } from "@/lib/telegram";

export function SplashScreen() {
  const [shown, setShown] = useState(true);
  // A remount after the frame has left must not paint it again. The server
  // render is always shown, so the first hydration still matches.
  if (typeof window !== "undefined" && splashIsDismissed() && shown) {
    setShown(false);
  }

  // Drop the frame before the theme paints, so a color-scheme change
  // cannot flash the WebView while the picture is still on screen.
  useLayoutEffect(() => {
    if (shown) return;
    releaseSplashChrome();
    clearSplashField();
  }, [shown]);

  useEffect(() => {
    if (splashIsDismissed()) return;

    let appReady = splashAppIsReady();
    let timer = 0;
    let removed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hide = () => {
      if (removed) return;
      removed = true;
      window.clearTimeout(timer);
      dismissSplash();
      setShown(false);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      const elapsed = splashVisibleElapsed(performance.now());
      // Still behind Telegram's own loader. The hold has not started.
      if (elapsed == null) return;
      const remain = splashRemainMs({
        elapsed,
        appReady,
        reducedMotion,
      });
      if (remain == null) {
        hide();
        return;
      }
      timer = window.setTimeout(schedule, remain);
    };

    const onReady = () => {
      appReady = true;
      schedule();
    };
    const onVisible = () => schedule();

    window.addEventListener(SPLASH_READY_EVENT, onReady);
    window.addEventListener(SPLASH_VISIBLE_EVENT, onVisible);
    schedule();
    // If the client never reports that the frame is visible, start the hold anyway.
    const safety = window.setTimeout(() => {
      markSplashVisible();
      schedule();
    }, SPLASH_MAX_MS + 600);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(safety);
      window.removeEventListener(SPLASH_READY_EVENT, onReady);
      window.removeEventListener(SPLASH_VISIBLE_EVENT, onVisible);
    };
  }, []);

  if (!shown) return null;

  return (
    <div
      className="splash-screen"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: SPLASH_CHROME,
      }}
    >
      {/* Inline box so the frame covers the page before the stylesheet arrives. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash.webp"
        alt="Between"
        width={780}
        height={1560}
        fetchPriority="high"
        decoding="sync"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

function clearSplashField() {
  const root = document.documentElement;
  root.style.backgroundColor = "";
  delete root.dataset.splash;
}
