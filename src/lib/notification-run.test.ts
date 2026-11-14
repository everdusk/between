import assert from "node:assert/strict";
import { it } from "node:test";
import { withNotificationRun } from "./notification-run";
import { notificationChoice } from "./notification-preferences";
import { digestAction, duePoll, tallyPollDay } from "./digest";
import { normalizeStore } from "./migrate";
import { emptyStore } from "./types";
import { dueCycle, sessionDigestDue, pingsReduced } from "./trial-cycle";
import { emptyWeekAccess, openWeekAccess } from "./week-access";

function claims() {
  const held = new Set<string>();
  return {
    claim: async (owner: string | number, day: string, slot: string) => {
      const key = `${owner}:${day}:${slot}`;
      if (held.has(key)) return false;
      held.add(key); return true;
    },
    release: async (owner: string | number, day: string, slot: string) => { held.delete(`${owner}:${day}:${slot}`); },
  };
}

it("sends once across simultaneous cron and webhook attempts for one journal", async () => {
  const storage = claims(); let sends = 0;
  const dispatch = async () => { sends++; await Promise.resolve(); return { sent: 1 }; };
  const results = await Promise.all(Array.from({ length: 8 }, () => withNotificationRun("journal", "2026-11-15", 21, dispatch, storage)));
  assert.equal(sends, 1);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await withNotificationRun("journal", "2026-11-15", 21, dispatch, storage), null);
  await withNotificationRun("journal", "2026-11-15", 22, dispatch, storage);
  assert.equal(sends, 2);
});

it("allows a retry after a confirmed non-delivery, but retains an uncertain delivery", async () => {
  const storage = claims();
  await withNotificationRun("j", "d", 9, async () => ({ sent: 0 }), storage);
  assert.deepEqual(await withNotificationRun("j", "d", 9, async () => ({ sent: 1 }), storage), { sent: 1 });
  await assert.rejects(withNotificationRun("j", "d", 18, async () => { throw new Error("provider accepted, bookkeeping failed"); }, storage));
  assert.equal(await withNotificationRun("j", "d", 18, async () => ({ sent: 1 }), storage), null);
});

it("preserves old defaults and an explicit notification opt-out when migrating", () => {
  assert.equal(normalizeStore(emptyStore())!.notify.moodFrequency, "three");
  assert.equal(normalizeStore(emptyStore())!.notify.serviceReminders, true);
  const store = emptyStore();
  store.notify = { ...store.notify, moodFrequency: "evening", moodPolls: false, serviceReminders: false };
  assert.equal(normalizeStore(store)!.notify.serviceReminders, false);
  assert.equal(normalizeStore(store)!.notify.moodFrequency, "evening");
  assert.equal(notificationChoice("nf:off"), "off");
  assert.equal(notificationChoice("nf:evening"), "evening");
  assert.equal(notificationChoice("ob:off"), null);
});

it("evening-only preference controls both scheduled and catch-up questions and statistics", () => {
  const store = emptyStore(); store.notify.moodFrequency = "evening";
  for (const hour of [9, 10, 14, 17]) {
    assert.equal(duePoll({ store, dateKey: "2026-11-15", hour }), null);
    assert.equal(digestAction({ store, dateKey: "2026-11-15", localHour: hour, alreadySent: false }).type, "skip");
  }
  assert.equal(duePoll({ store, dateKey: "2026-11-15", hour: 18 }), "evening");
  const person = { blocked: false, moodPolls: true, moodFrequency: "evening" as const, pollsOpen: true, reduced: false, hour: 14,
    slots: [{ slot: "morning" as const, sent: false, answered: false }, { slot: "evening" as const, sent: false, answered: false }] };
  assert.equal(tallyPollDay([person]).expected, 0);
  assert.equal(tallyPollDay([{ ...person, hour: 18 }]).expected, 1);
});

const plan = { mode: "weekly" as const, weekday: 0, date: "", time: "18:00", slots: [{ weekday: 0, time: "18:00" }], updatedAt: "2026-11-01T00:00:00Z" };
const record = openWeekAccess(emptyWeekAccess(), new Date("2026-11-02T12:00:00Z"));
const base = { record, status: "trial" as const, plan, dateKey: "2026-11-06", hour: 12, now: new Date("2026-11-06T09:00:00Z"), timeZone: "Europe/Moscow", onboardingOpen: false };

it("midpoint is reachable between weekly sessions and onboarding suppresses all cycle messages", () => {
  assert.equal(dueCycle(base)[0]?.kind, "midpoint");
  assert.deepEqual(dueCycle({ ...base, onboardingOpen: true }), []);
  assert.deepEqual(dueCycle({ ...base, onboardingOpen: true, dateKey: "2026-11-09" }), []);
  assert.deepEqual(dueCycle({ ...base, engaged: false, dateKey: "2026-11-09", plan: null, now: new Date("2026-11-09T09:00:00Z") }), []);
});

it("prepares an early session the previous evening and never sends a summary after the session", () => {
  const early = { ...plan, time: "08:00", slots: [{ weekday: 0, time: "08:00" }] };
  assert.deepEqual(sessionDigestDue(early, "2026-11-08", 21), { date: "2026-11-09", time: "08:00" });
  assert.equal(sessionDigestDue(early, "2026-11-09", 9), null);
  assert.equal(sessionDigestDue(plan, "2026-11-09", 15), null);
  assert.deepEqual(sessionDigestDue(plan, "2026-11-09", 16), { date: "2026-11-09", time: "18:00" });
  assert.equal(sessionDigestDue(plan, "2026-11-09", 18), null);
});

it("gives the session summary priority over the day-seven offer", () => {
  const result = dueCycle({ ...base, dateKey: "2026-11-09", hour: 16, now: new Date("2026-11-09T13:00:00Z") });
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, "digest-full");
});

it("an explicit preference change resumes questions for three days of inactivity", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  assert.equal(pingsReduced(record.openedAt, [], now), true);
  assert.equal(pingsReduced(record.openedAt, [], now, "2026-11-15T11:00:00Z"), false);
});

it("does not follow the final payment reminder with another or send both on one day", () => {
  const input = { ...base, status: "locked" as const, dateKey: "2026-11-11", hour: 12, plan: { ...plan, weekday: 3, slots: [{ weekday: 3, time: "18:00" }] }, now: new Date("2026-11-11T09:00:00Z") };
  const wall = { ...record, paywallAt: "2026-11-09T09:00:00Z" };
  assert.deepEqual(dueCycle({ ...input, record: { ...wall, nudge2At: "2026-11-11T08:00:00Z" } }), []);
  assert.deepEqual(dueCycle({ ...input, record: { ...wall, nudge1At: "2026-11-11T08:00:00Z" } }), []);
});
