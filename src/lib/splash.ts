/** How long the launch frame stays up once the journal can be shown. */
export const SPLASH_MIN_MS = 1100;
/** Gives up if the journal never leaves loading, so the frame cannot trap the app. */
export const SPLASH_MAX_MS = 2400;
/** Reduced motion still covers the first paint, then leaves. */
export const SPLASH_REDUCED_MAX_MS = 280;
export const SPLASH_FADE_MS = 420;

export const SPLASH_READY_EVENT = "between-splash-ready";

let appReady = false;

/** Journal shell is on screen. Safe to call more than once. */
export function markSplashReady() {
  appReady = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SPLASH_READY_EVENT));
}

export function splashAppIsReady(): boolean {
  return appReady;
}

/**
 * Milliseconds until the next decision, or null when the frame should leave.
 * A ready app waits out the minimum. An app that never gets ready leaves at the cap.
 */
export function splashRemainMs(input: {
  elapsed: number;
  appReady: boolean;
  reducedMotion: boolean;
}): number | null {
  const max = input.reducedMotion ? SPLASH_REDUCED_MAX_MS : SPLASH_MAX_MS;
  const min = input.reducedMotion ? 0 : SPLASH_MIN_MS;
  if (input.elapsed >= max) return null;
  if (input.appReady && input.elapsed >= min) return null;
  if (input.appReady) return min - input.elapsed;
  return max - input.elapsed;
}
