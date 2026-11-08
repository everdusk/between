import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPLASH_MAX_MS,
  SPLASH_MIN_MS,
  SPLASH_REDUCED_MAX_MS,
  SPLASH_STAMP,
  markSplashVisible,
  resetSplashClock,
  splashRemainMs,
  splashShouldWaitForViewport,
  splashViewportSettled,
  splashVisibleElapsed,
} from "./splash";

describe("splash", () => {
  it("holds the frame until the minimum once the journal is ready", () => {
    assert.equal(splashRemainMs({ elapsed: 400, appReady: true, reducedMotion: false }), SPLASH_MIN_MS - 400);
    assert.equal(splashRemainMs({ elapsed: SPLASH_MIN_MS, appReady: true, reducedMotion: false }), null);
  });

  it("waits out the cap when the journal is still loading", () => {
    assert.equal(splashRemainMs({ elapsed: 0, appReady: false, reducedMotion: false }), SPLASH_MAX_MS);
    assert.equal(splashRemainMs({ elapsed: SPLASH_MAX_MS, appReady: false, reducedMotion: false }), null);
  });

  it("starts the hold when the frame becomes visible, and ignores a second call", () => {
    resetSplashClock();
    assert.equal(splashVisibleElapsed(1_000), null);
    markSplashVisible(1_000);
    assert.equal(splashVisibleElapsed(1_600), 600);
    markSplashVisible(2_000);
    assert.equal(splashVisibleElapsed(1_600), 600);
    resetSplashClock();
  });

  it("counts from the frame painted at parse time, before hydration", () => {
    resetSplashClock();
    const previous = globalThis.window;
    globalThis.window = { [SPLASH_STAMP]: 100 } as unknown as Window & typeof globalThis;
    assert.equal(splashVisibleElapsed(1_000), 900);
    markSplashVisible(2_000);
    assert.equal(splashVisibleElapsed(1_200), 1_100);
    resetSplashClock();
    globalThis.window = previous;
  });

  it("waits to reveal until the telegram window has finished expanding", () => {
    assert.equal(
      splashViewportSettled({ expanded: false, viewportHeight: 700, stableHeight: 700 }),
      false,
    );
    assert.equal(
      splashViewportSettled({ expanded: true, viewportHeight: 640, stableHeight: 700 }),
      false,
    );
    assert.equal(
      splashViewportSettled({ expanded: true, viewportHeight: 0, stableHeight: 0 }),
      false,
    );
    assert.equal(
      splashViewportSettled({ expanded: true, viewportHeight: 700, stableHeight: 700 }),
      true,
    );
    assert.equal(splashShouldWaitForViewport("ios"), true);
    assert.equal(splashShouldWaitForViewport("tdesktop"), false);
    assert.equal(splashShouldWaitForViewport("android"), false);
  });

  it("leaves as soon as the journal is ready when motion is reduced", () => {
    assert.equal(splashRemainMs({ elapsed: 0, appReady: true, reducedMotion: true }), null);
    assert.equal(
      splashRemainMs({ elapsed: 0, appReady: false, reducedMotion: true }),
      SPLASH_REDUCED_MAX_MS,
    );
    assert.equal(
      splashRemainMs({ elapsed: SPLASH_REDUCED_MAX_MS, appReady: false, reducedMotion: true }),
      null,
    );
  });
});
