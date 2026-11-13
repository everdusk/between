import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionPlan } from "./types";
import { dueCycle, pingsReduced, quietHour } from "./trial-cycle";
import { emptyWeekAccess, grantStackedPlan, openWeekAccess, pauseWeek, resumeWeek, voiceNotesOpen } from "./week-access";

const TZ = "Europe/Moscow";

function weekly(weekday: number, time = "18:00"): SessionPlan {
  return {
    mode: "weekly",
    date: "",
    time,
    weekday,
    slots: [{ weekday, time }],
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

function access(openedAt: string) {
  return { ...openWeekAccess(emptyWeekAccess(), new Date(openedAt)), openedAt };
}

describe("trial cycle", () => {
  const start = "2026-11-02T12:00:00.000Z";

  it("sends a full sheet at 09:00 on a weekly session and a short one inside three days", () => {
    const full = dueCycle({
      record: access(start),
      status: "trial",
      plan: weekly(3),
      dateKey: "2026-11-05",
      hour: 9,
      now: new Date("2026-11-05T06:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(full.some((item) => item.kind === "digest-full"), true);

    const mini = dueCycle({
      record: access(start),
      status: "trial",
      plan: {
        ...weekly(0),
        slots: [
          { weekday: 0, time: "18:00" },
          { weekday: 2, time: "18:00" },
        ],
      },
      dateKey: "2026-11-04",
      hour: 9,
      now: new Date("2026-11-04T06:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(mini.some((item) => item.kind === "digest-mini"), true);
    assert.equal(mini.some((item) => item.kind === "digest-full"), false);
  });

  it("keeps the slice and paywall on day 7 at noon, and the soft reminder on day 5", () => {
    const record = access(start);
    const day5 = dueCycle({
      record,
      status: "trial",
      plan: weekly(3),
      dateKey: "2026-11-07",
      hour: 21,
      now: new Date("2026-11-07T18:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(day5.some((item) => item.kind === "day5"), true);

    const day7 = dueCycle({
      record,
      status: "trial",
      plan: weekly(3),
      dateKey: "2026-11-09",
      hour: 12,
      now: new Date("2026-11-09T09:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(day7.some((item) => item.kind === "slice"), true);
    assert.equal(day7.find((item) => item.kind === "paywall")?.variant, "ahead");
  });

  it("nudges twice after the paywall and then stays quiet", () => {
    const record = {
      ...access(start),
      paywallAt: "2026-11-09T09:00:00.000Z",
    };
    const first = dueCycle({
      record,
      status: "locked",
      plan: weekly(3),
      dateKey: "2026-11-11",
      hour: 12,
      now: new Date("2026-11-11T09:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(first.some((item) => item.kind === "nudge1"), true);
    const second = dueCycle({
      record: { ...record, nudge1At: "2026-11-11T09:00:00.000Z" },
      status: "locked",
      plan: weekly(3),
      dateKey: "2026-11-11",
      hour: 21,
      now: new Date("2026-11-11T18:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(second.some((item) => item.kind === "nudge2"), true);
    assert.equal(second.some((item) => item.kind === "nudge1"), false);
  });

  it("does not send pings while paused and stacks a new purchase onto the current end", () => {
    const paid = grantStackedPlan(emptyWeekAccess(), "month", new Date(start));
    const paused = pauseWeek(paid, new Date("2026-11-10T12:00:00.000Z"));
    assert.ok(paused);
    const quiet = dueCycle({
      record: paused,
      status: "paid",
      plan: weekly(3),
      dateKey: "2026-11-12",
      hour: 9,
      now: new Date("2026-11-12T06:00:00.000Z"),
      timeZone: TZ,
      onboardingOpen: false,
    });
    assert.equal(quiet.length, 0);
    const resumed = resumeWeek(paused, new Date("2026-11-12T12:00:00.000Z"));
    const stacked = grantStackedPlan(resumed, "month", new Date("2026-11-12T12:00:00.000Z"));
    assert.ok(Date.parse(stacked.paidUntil ?? "") > Date.parse(resumed.paidUntil ?? ""));
    assert.equal(voiceNotesOpen(access(start), new Date(start)), true);
    assert.equal(quietHour(8), true);
    assert.equal(quietHour(9), false);
    assert.equal(pingsReduced(start, [], new Date("2026-11-06T12:00:00.000Z")), true);
    assert.equal(
      pingsReduced(start, [{ createdAt: "2026-11-05T12:00:00.000Z" }], new Date("2026-11-06T12:00:00.000Z")),
      false,
    );
  });
});
