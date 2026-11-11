import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionBriefDue, sessionPdfCaption, sessionPdfOpen } from "./session-brief";
import type { SessionPlan } from "./types";

const THURSDAY = "2026-01-08";

function weekly(time = "18:00"): SessionPlan {
  return {
    mode: "weekly",
    date: "",
    time,
    weekday: 3,
    slots: [{ weekday: 3, time }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("session pdf", () => {
  it("is due on the session day from two hours before until the session hour", () => {
    const plan = weekly("18:30");
    assert.equal(sessionBriefDue({ plan, dateKey: THURSDAY, hour: 15 }), null);
    assert.deepEqual(sessionBriefDue({ plan, dateKey: THURSDAY, hour: 16 }), { time: "18:30" });
    assert.deepEqual(sessionBriefDue({ plan, dateKey: THURSDAY, hour: 17 }), { time: "18:30" });
    assert.equal(sessionBriefDue({ plan, dateKey: THURSDAY, hour: 18 }), null);
    assert.equal(sessionBriefDue({ plan, dateKey: "2026-01-07", hour: 16 }), null);
    assert.equal(sessionBriefDue({ plan: weekly("01:00"), dateKey: THURSDAY, hour: 0 }), null);
    assert.deepEqual(
      sessionBriefDue({
        plan: { ...weekly(), mode: "once", date: THURSDAY, slots: [] },
        dateKey: THURSDAY,
        hour: 16,
      }),
      { time: "18:00" },
    );
    assert.equal(sessionBriefDue({ plan: null, dateKey: THURSDAY, hour: 16 }), null);
  });

  it("sends while premium is paid or the trial is still open", () => {
    assert.equal(sessionPdfOpen("paid"), true);
    assert.equal(sessionPdfOpen("trial"), true);
    assert.equal(sessionPdfOpen("locked"), false);
    assert.equal(sessionPdfOpen("new"), false);
  });

  it("puts only the session time on the file, not the summary", () => {
    assert.equal(sessionPdfCaption("ru", "18:30"), "К сеансу в 18:30.");
    assert.equal(sessionPdfCaption("en", "18:30"), "Session at 18:30.");
  });
});
