import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SPLASH_MAX_MS, SPLASH_MIN_MS, SPLASH_REDUCED_MAX_MS, splashRemainMs } from "./splash";

describe("splash", () => {
  it("holds the frame until the minimum once the journal is ready", () => {
    assert.equal(splashRemainMs({ elapsed: 400, appReady: true, reducedMotion: false }), SPLASH_MIN_MS - 400);
    assert.equal(splashRemainMs({ elapsed: SPLASH_MIN_MS, appReady: true, reducedMotion: false }), null);
  });

  it("waits out the cap when the journal is still loading", () => {
    assert.equal(splashRemainMs({ elapsed: 0, appReady: false, reducedMotion: false }), SPLASH_MAX_MS);
    assert.equal(splashRemainMs({ elapsed: SPLASH_MAX_MS, appReady: false, reducedMotion: false }), null);
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
