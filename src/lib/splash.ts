/** How long the launch frame stays up once the journal can be shown. */
export const SPLASH_MIN_MS = 1100;
/** Gives up if the journal never leaves loading, so the frame cannot trap the app. */
export const SPLASH_MAX_MS = 2400;
/** Reduced motion still covers the first paint, then leaves. */
export const SPLASH_REDUCED_MAX_MS = 280;
/**
 * Telegram expand keeps resizing the WebView after the page is up.
 * Wait for a settled window before ready(), but don't leave the native
 * loader up if the client never reports one.
 */
export const SPLASH_VIEWPORT_WAIT_MS = 700;
export const SPLASH_READY_EVENT = "between-splash-ready";
/** Fired once the frame is actually on screen. In Telegram that is WebApp.ready(). */
export const SPLASH_VISIBLE_EVENT = "between-splash-visible";

let appReady = false;
let visibleAt: number | null = null;
let dismissed = false;

/** Journal shell is on screen. Safe to call more than once. */
export function markSplashReady() {
  appReady = true;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SPLASH_READY_EVENT));
}

export function splashAppIsReady(): boolean {
  return appReady;
}

/** The frame has been shown. Later calls do not move the clock. */
export function markSplashVisible(now = performance.now()): void {
  if (visibleAt != null) return;
  visibleAt = now;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SPLASH_VISIBLE_EVENT));
}

/** Milliseconds since the frame became visible, or null while it is still covered. */
export function splashVisibleElapsed(now: number): number | null {
  if (visibleAt == null) return null;
  return now - visibleAt;
}

export function splashIsDismissed(): boolean {
  return dismissed;
}

export function dismissSplash(): void {
  dismissed = true;
}

/** Test isolation. The page load is the real reset. */
export function resetSplashClock(): void {
  appReady = false;
  visibleAt = null;
  dismissed = false;
}

/**
 * Milliseconds until the next decision, or null when the frame should leave.
 * A ready app waits out the minimum. An app that never gets ready leaves at the cap.
 */
/**
 * The expand animation is finished when the Mini App is open and the
 * visible height matches the stable one. A zero height is still the loader.
 */
export function splashViewportSettled(input: {
  expanded: boolean;
  viewportHeight: number;
  stableHeight: number;
}): boolean {
  return (
    input.expanded &&
    input.stableHeight > 0 &&
    input.viewportHeight === input.stableHeight
  );
}

/**
 * iOS reports the window as already expanded until the first viewport event,
 * then animates expand under the page. Other clients are already at size.
 */
export function splashShouldWaitForViewport(platform: string): boolean {
  return platform === "ios";
}

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
