import assert from "node:assert/strict";
import { it } from "node:test";
import { timePattern } from "./spectrum";
import type { CheckinSlot, Feeling, JournalEntry } from "./types";

function check(day: number, slot: CheckinSlot, feeling: Feeling): JournalEntry {
  return { id: `${day}-${slot}`, date: `2026-11-${String(day).padStart(2, "0")}`,
    createdAt: "2026-11-15T08:00:00Z", updatedAt: "2026-11-15T08:00:00Z",
    body: "", feelings: [feeling], tags: [], source: "checkin", slot };
}

it("finds a repeated within-day change, with one vote per day", () => {
  const entries = [11, 12, 13].flatMap((day) => [check(day, "morning", "спокойно"), check(day, "evening", "тревожно")]);
  assert.deepEqual(timePattern(entries), { key: "spectrumTimeEveningHeavy", matches: 3, days: 3 });
  entries.push(check(14, "morning", "спокойно"), check(14, "evening", "спокойно"));
  assert.equal(timePattern(entries).matches, 3);
  entries.push(check(15, "morning", "спокойно"), check(15, "evening", "спокойно"));
  assert.equal(timePattern(entries).key, "spectrumTimeUnclear");
});

it("does not infer a rhythm from only evening answers, extra notes, or one difficult day", () => {
  const eveningOnly = [11, 12, 13, 14].map((day) => check(day, "evening", "тревожно"));
  assert.equal(timePattern(eveningOnly).key, "spectrumTimeFew");
  const oneDay = Array.from({ length: 20 }, () => [check(11, "morning", "спокойно"), check(11, "evening", "тревожно")]).flat();
  assert.equal(timePattern(oneDay).key, "spectrumTimeFew");
  const notes = [11, 12, 13].flatMap((day) => [check(day, "morning", "спокойно"), { ...check(day, "evening", "тревожно"), source: "bot" as const }]);
  assert.equal(timePattern(notes).key, "spectrumTimeFew");
});

it("also recognises improvement and midday changes without timezone guesses", () => {
  const evening = [11, 12, 13].flatMap((day) => [check(day, "morning", "тревожно"), check(day, "evening", "спокойно")]);
  assert.equal(timePattern(evening).key, "spectrumTimeEveningLight");
  const midday = [11, 12, 13].flatMap((day) => [check(day, "morning", "спокойно"), check(day, "day", "усталость")]);
  assert.equal(timePattern(midday).key, "spectrumTimeDayHeavy");
});
