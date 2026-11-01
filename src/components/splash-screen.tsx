"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (splashIsDismissed()) {
      clearSplashField();
      return;
    }

    let appReady = splashAppIsReady();
    let timer = 0;
    let removed = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const hide = () => {
      if (removed) return;
      removed = true;
      window.clearTimeout(timer);
      dismissSplash();
      releaseSplashChrome();
      clearSplashField();
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
        inset: 0,
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
        width={1080}
        height={1920}
        fetchPriority="high"
        decoding="sync"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}

function clearSplashField() {
  document.documentElement.style.backgroundColor = "";
}
