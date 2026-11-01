"use client";

import { useEffect, useState } from "react";
import {
  SPLASH_FADE_MS,
  SPLASH_READY_EVENT,
  splashAppIsReady,
  splashRemainMs,
} from "@/lib/splash";
import { releaseSplashChrome, SPLASH_CHROME } from "@/lib/telegram";

export function SplashScreen() {
  const [shown, setShown] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const started = performance.now();
    let appReady = splashAppIsReady();
    let timer = 0;
    let fadeTimer = 0;
    let removed = false;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const beginHide = () => {
      if (removed) return;
      removed = true;
      window.clearTimeout(timer);
      const fade = fadeMs(reducedMotion);
      if (fade === 0) {
        releaseSplashChrome();
        setShown(false);
        return;
      }
      setLeaving(true);
      fadeTimer = window.setTimeout(() => {
        releaseSplashChrome();
        setShown(false);
      }, fade);
    };

    const schedule = () => {
      window.clearTimeout(timer);
      const remain = splashRemainMs({
        elapsed: performance.now() - started,
        appReady,
        reducedMotion,
      });
      if (remain == null) {
        beginHide();
        return;
      }
      timer = window.setTimeout(schedule, remain);
    };

    const onReady = () => {
      appReady = true;
      schedule();
    };

    window.addEventListener(SPLASH_READY_EVENT, onReady);
    schedule();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fadeTimer);
      window.removeEventListener(SPLASH_READY_EVENT, onReady);
    };
  }, []);

  if (!shown) return null;

  return (
    <div
      className={`splash-screen fixed inset-0 z-[80] flex items-center justify-center transition-opacity duration-[420ms] ease-out ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      style={{ backgroundColor: SPLASH_CHROME }}
      aria-hidden={leaving ? true : undefined}
    >
      {/* Static file in the first HTML. next/image would wait on its runtime. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/splash.webp"
        alt="Between"
        width={1080}
        height={1920}
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function fadeMs(reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (document.documentElement.dataset.performance === "low") return 0;
  return SPLASH_FADE_MS;
}
