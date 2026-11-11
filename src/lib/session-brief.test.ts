import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionBriefDue, sessionBriefText } from "./session-brief";
import { emptyStore, type JournalEntry, type SessionPlan, type SessionTheme } from "./types";

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

function theme(partial: Partial<SessionTheme> & Pick<SessionTheme, "id" | "title" | "status">): SessionTheme {
  return {
    userId: "1",
    count: 2,
    firstSeen: "2026-01-06",
    lastSeen: "2026-01-07",
    peakIntensity: 3,
    reopened: false,
    dismissed: false,
    confidence: 0.8,
    summary: partial.title,
    quotes: [],
    updatedAt: "2026-01-07T00:00:00.000Z",
    ...partial,
  };
}

describe("session brief", () => {
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

  it("names the pattern, the most common mood, and the open backlog", () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const entry: JournalEntry = {
      id: "e1",
      date: "2026-01-07",
      createdAt: "2026-01-07T08:00:00.000Z",
      updatedAt: "2026-01-07T08:00:00.000Z",
      body: "Перед встречей снова тревожно",
      feelings: ["тревожно", "тревожно"],
      tags: [],
      source: "bot",
    };
    const calm: JournalEntry = {
      ...entry,
      id: "e2",
      feelings: ["спокойно"],
      body: "Утро тихое и ровное",
    };
    store.entries = [entry, { ...entry, id: "e3", createdAt: "2026-01-07T19:00:00.000Z" }, calm];
    store.themes = [
      theme({ id: "open", title: "Тревога перед встречей", status: "active" }),
      theme({ id: "said", title: "Уже сказано", status: "discussed", discussedAt: "2026-01-07T12:00:00.000Z" }),
      theme({ id: "gone", title: "Убранная тема", status: "active", dismissed: true }),
    ];
    store.weekPreps = [
      {
        weekKey: "other",
        talkNotes: "",
        updatedAt: "2026-01-07T00:00:00.000Z",
        patternText: "Тревога перед встречами возвращается по утрам.",
      },
    ];
    const text = sessionBriefText({
      store,
      locale: "ru",
      todayKey: THURSDAY,
      now: new Date(2026, 0, 8, 16, 0, 0),
      time: "18:00",
    });
    assert.match(text, /К сеансу в 18:00/);
    assert.match(text, /Что смотрится как паттерн/);
    assert.match(text, /Тревога перед встречами возвращается по утрам/);
    assert.match(text, /Чаще всего — тревожно/);
    assert.match(text, /Что обсудить/);
    assert.match(text, /• Тревога перед встречей/);
    assert.doesNotMatch(text, /Уже сказано/);
    assert.doesNotMatch(text, /Убранная тема/);
  });
});
