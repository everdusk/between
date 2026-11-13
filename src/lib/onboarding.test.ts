import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOnboarding,
  checkinSlotForHour,
  freshOnboarding,
  onboardPrompt,
  parseOnboardCallback,
  parseOnboarding,
  scheduleWhen,
} from "./onboarding";
import { weeklySessionPlan } from "./session-plan";

describe("onboarding", () => {
  it("walks a therapist schedule into the mood question and the first note", () => {
    const yes = applyOnboarding(freshOnboarding(), { kind: "yes" });
    assert.equal(yes.ok, true);
    if (!yes.ok) return;
    const tuesday = applyOnboarding(yes.state, { kind: "toggle", day: 1 });
    const friday = tuesday.ok ? applyOnboarding(tuesday.state, { kind: "toggle", day: 4 }) : tuesday;
    assert.equal(friday.ok && friday.markupOnly, true);
    if (!friday.ok) return;
    assert.deepEqual(friday.state.days, [1, 4]);
    const cleared = applyOnboarding(friday.state, { kind: "toggle", day: 1 });
    assert.deepEqual(cleared.ok && cleared.state.days, [4]);
    assert.equal(applyOnboarding({ step: "days", days: [] }, { kind: "days-done" }).ok, false);

    const clock = applyOnboarding(friday.state, { kind: "days-done" });
    if (!clock.ok) return;
    const picked = applyOnboarding(clock.state, { kind: "time", time: "18:00" });
    if (!picked.ok) return;
    assert.deepEqual(picked.plan, { days: [1, 4], time: "18:00" });
    const asked = onboardPrompt(picked.state, "ru");
    assert.match(asked?.text ?? "", /Сеансы/);
    assert.match(asked?.text ?? "", /вторник, пятница · 18:00/);
    assert.equal(scheduleWhen([4, 1], "18:00", "ru"), "вторник, пятница · 18:00");

    const mood = applyOnboarding(picked.state, { kind: "mood", index: 1 });
    if (!mood.ok) return;
    assert.equal(mood.feeling, "спокойно");
    assert.equal(mood.state.step, "note");
    assert.match(onboardPrompt(mood.state, "ru")?.text ?? "", /спокойно/);
    assert.equal(applyOnboarding({ step: "done", days: [] }, { kind: "yes" }).ok, false);
  });

  it("skips the schedule when there is no therapist and still asks for a mood", () => {
    const skip = applyOnboarding(freshOnboarding(), { kind: "no" });
    assert.equal(skip.ok && skip.state.via, "skip");
    if (!skip.ok) return;
    const text = onboardPrompt(skip.state, "ru")?.text ?? "";
    assert.match(text, /психотерапевт/);
    assert.match(text, /Как вы сейчас/);
    assert.equal(onboardPrompt(skip.state, "ru")?.rows.flat().length, 9);
    assert.equal(applyOnboarding(skip.state, { kind: "days-done" }).ok, false);
  });

  it("reads the button payloads and builds the day and time keyboards", () => {
    assert.deepEqual(parseOnboardCallback("ob:y"), { kind: "yes" });
    assert.deepEqual(parseOnboardCallback("ob:n"), { kind: "no" });
    assert.deepEqual(parseOnboardCallback("ob:d:6"), { kind: "toggle", day: 6 });
    assert.deepEqual(parseOnboardCallback("ob:h:09"), { kind: "time", time: "09:00" });
    assert.deepEqual(parseOnboardCallback("ob:h:21"), { kind: "time", time: "21:00" });
    assert.equal(parseOnboardCallback("ob:h:08"), null);
    assert.equal(parseOnboardCallback("ob:f:9"), null);
    assert.equal(parseOnboardCallback("c:m:0"), null);
    assert.equal(checkinSlotForHour(9), "morning");
    assert.equal(checkinSlotForHour(14), "day");
    assert.equal(checkinSlotForHour(18), "evening");
    assert.deepEqual(parseOnboarding({ step: "days", days: [3, 3, 9, "1"], time: "18:00", via: "plan" })?.days, [3]);

    const days = onboardPrompt({ step: "days", days: [0] }, "ru");
    assert.equal(days?.rows[0][0].text.startsWith("✓"), true);
    assert.equal(days?.rows[0][1].data, "ob:d:1");
    assert.equal(days?.rows[2][0].data, "ob:ok");
    const times = onboardPrompt({ step: "time", days: [0] }, "ru");
    assert.equal(times?.rows.flat().length, 13);
    assert.equal(times?.rows.at(-1)?.at(-1)?.data, "ob:h:21");

    const plan = weeklySessionPlan([4, 1, 1], "18:00", "2026-11-11T00:00:00.000Z");
    assert.deepEqual(plan?.slots?.map((slot) => slot.weekday), [1, 4]);
    assert.equal(plan?.time, "18:00");
    assert.equal(plan?.weekday, 1);
    assert.equal(weeklySessionPlan([], "18:00", "x"), null);
    assert.equal(weeklySessionPlan([1], "25:00", "x"), null);
  });
});
