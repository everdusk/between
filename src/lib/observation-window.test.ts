import assert from "node:assert/strict";
import { it } from "node:test";
import { observationWindow } from "./session-summary";

it("uses the entire calendar week when no session schedule is set", () => {
  const window = observationWindow([], [], "2026-11-19", new Date(2026, 10, 19, 12), null);
  assert.equal(window.days[0], "2026-11-16");
  assert.equal(window.days.at(-1), "2026-11-22");
  assert.equal(window.previousDays[0], "2026-11-09");
});
