import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPollDay, moodPollsOpen, parseDigestRun, tallyPollDay, type PollPerson, type PollSlotState } from "./digest";
import { maxDeliveryBlocked } from "./max-bot";
import { returnedTelegramUser, telegramDeliveryBlocked } from "./telegram-bot";
import { accessForUser, emptyWeekAccess, openWeekAccess, TRIAL_MS } from "./week-access";

const RUN = { at: "2026-11-13T08:00:03.000Z", users: 12, sent: 3, skipped: 9, failed: 1, errors: 0, ms: 2400 };

function slots(patch: Partial<Record<PollSlotState["slot"], Partial<PollSlotState>>> = {}): PollSlotState[] {
  return (["morning", "day", "evening"] as const).map((slot) => ({
    slot,
    sent: false,
    answered: false,
    ...patch[slot],
  }));
}

function person(hour: number, patch: Partial<PollPerson> = {}): PollPerson {
  return {
    blocked: false,
    moodPolls: true,
    pollsOpen: true,
    reduced: false,
    hour,
    slots: slots(),
    ...patch,
  };
}

describe("digest run summary", () => {
  it("reads a stored run and ignores junk", () => {
    const run = parseDigestRun({ at: "2026-11-09T10:00:03.000Z", users: "12", sent: 3, skipped: 9, failed: 0, errors: 0, ms: 2400 });
    assert.ok(run);
    assert.equal(run.users, 12);
    assert.equal(run.sent, 3);
    assert.equal(parseDigestRun({ users: 1 }), null);
    assert.equal(parseDigestRun("nope"), null);
    assert.equal(parseDigestRun({ at: "not a date" }), null);
  });

  it("counts the day in each person's clock, not the last hourly pass", () => {
    const fresh = formatPollDay({ expected: 9, received: 7, replied: 4 }, RUN, new Date("2026-11-13T08:40:00.000Z"));
    assert.equal(
      fresh,
      "Опросы сегодня, по их времени\nДолжны были получить 9 человек\nПолучили все положенные 7\nОтветили на все 4",
    );

    const stale = formatPollDay(
      { expected: 9, received: 1, replied: 0 },
      { ...RUN, at: "2026-11-12T08:00:03.000Z" },
      new Date("2026-11-13T08:40:00.000Z"),
    );
    assert.match(stale, /Расписание молчит 24 ч\. Проверьте QStash\./);
    assert.match(stale, /Должны были получить 9 человек/);

    assert.match(formatPollDay({ expected: 0, received: 0, replied: 0 }, null), /ещё не запускалось/i);
  });

  it("counts a person once for the polls already due where they live", () => {
    const morningWaiting = person(10);
    const morningSent = person(10, { slots: slots({ morning: { sent: true } }) });
    const morningAnswered = person(10, { slots: slots({ morning: { sent: true, answered: true } }) });
    const loggedInApp = person(10, { slots: slots({ morning: { answered: true } }) });
    const tooEarly = person(8);
    const blocked = person(10, { blocked: true });
    const pollsOff = person(10, { moodPolls: false });
    const paused = person(10, { pollsOpen: false });
    const quiet = person(10, { reduced: true });
    // Morning was missed, so the day question is the one still owed.
    const catchUp = person(15);
    const catchUpSent = person(15, { slots: slots({ day: { sent: true } }) });
    // Morning went out, and the day question is due but not sent yet.
    const dayStillOwed = person(15, { slots: slots({ morning: { sent: true, answered: true } }) });
    const bothAnswered = person(15, {
      slots: slots({
        morning: { sent: true, answered: true },
        day: { sent: true, answered: true },
      }),
    });

    assert.deepEqual(tallyPollDay([morningWaiting]), { expected: 1, received: 0, replied: 0 });
    assert.deepEqual(tallyPollDay([morningSent]), { expected: 1, received: 1, replied: 0 });
    assert.deepEqual(tallyPollDay([morningAnswered]), { expected: 1, received: 1, replied: 1 });
    assert.deepEqual(tallyPollDay([loggedInApp, tooEarly, blocked, pollsOff, paused, quiet]), {
      expected: 0,
      received: 0,
      replied: 0,
    });
    assert.deepEqual(tallyPollDay([catchUp]), { expected: 1, received: 0, replied: 0 });
    assert.deepEqual(tallyPollDay([catchUpSent]), { expected: 1, received: 1, replied: 0 });
    assert.deepEqual(tallyPollDay([dayStillOwed]), { expected: 1, received: 0, replied: 0 });
    assert.deepEqual(tallyPollDay([bothAnswered, morningAnswered]), { expected: 2, received: 2, replied: 2 });
  });
});

describe("blocked delivery", () => {
  it("recognises a person who blocked the bot and one who came back", () => {
    assert.equal(telegramDeliveryBlocked("Forbidden: bot was blocked by the user"), true);
    assert.equal(telegramDeliveryBlocked("Forbidden: user is deactivated"), false);
    assert.equal(maxDeliveryBlocked({ code: "chat.denied", message: "Key: error.dialog.suspended" }), true);
    assert.equal(maxDeliveryBlocked({ code: "proto.payload", message: "something else" }), false);
    assert.deepEqual(
      returnedTelegramUser({
        chat: { id: 7, type: "private" },
        from: { id: 7 },
        old_chat_member: { status: "kicked" },
        new_chat_member: { status: "member" },
      }),
      { id: 7 },
    );
    assert.equal(
      returnedTelegramUser({
        chat: { id: 7, type: "private" },
        old_chat_member: { status: "member" },
        new_chat_member: { status: "kicked" },
      }),
      null,
    );
  });
});

describe("owner polls after the trial", () => {
  it("stays open in telegram by name and in max by name or max id", () => {
    const now = new Date("2026-11-14T12:00:00.000Z");
    const record = openWeekAccess(emptyWeekAccess(), new Date(now.getTime() - TRIAL_MS - 60_000));
    const open = (status: string, paused: boolean) =>
      moodPollsOpen({ onboardingOpen: false, paused, status });
    const hidden = accessForUser(record, { id: 7 }, undefined, now);
    const named = accessForUser(record, { id: 7, username: "aliatorovskaia" }, undefined, now);
    const maxNamed = accessForUser(record, { id: 0, username: "aliatorovskaia" }, undefined, now);
    const maxOwner = accessForUser(record, { id: 0, maxId: 1062664437 }, undefined, now);
    const maxOther = accessForUser(record, { id: 0, maxId: 42 }, undefined, now);
    const telegramWithMaxNumber = accessForUser(record, { id: 1062664437 }, undefined, now);
    assert.equal(open(hidden.view.status, hidden.view.paused), false);
    assert.equal(open(named.view.status, named.view.paused), true);
    assert.equal(open(maxNamed.view.status, maxNamed.view.paused), true);
    assert.equal(open(maxOwner.view.status, maxOwner.view.paused), true);
    assert.equal(open(maxOther.view.status, maxOther.view.paused), false);
    assert.equal(open(telegramWithMaxNumber.view.status, telegramWithMaxNumber.view.paused), false);
  });
});
