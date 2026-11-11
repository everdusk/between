import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSessionPdfModel, renderSessionPdf } from "./session-pdf";
import { therapyWindow } from "./session-summary";
import { emptyStore, type JournalEntry, type SessionPlan, type SessionTheme } from "./types";

const THURSDAY = "2026-01-08";

function weekly(): SessionPlan {
  return {
    mode: "weekly",
    date: "",
    time: "18:00",
    weekday: 3,
    slots: [{ weekday: 3, time: "18:00" }],
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

describe("session pdf sheet", () => {
  it("keeps the pattern and the open backlog, and leaves dismissed themes out", () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const entry: JournalEntry = {
      id: "e1",
      date: "2026-01-07",
      createdAt: "2026-01-07T08:00:00.000Z",
      updatedAt: "2026-01-07T08:00:00.000Z",
      body: "Перед встречей снова тревожно",
      feelings: ["тревожно"],
      tags: [],
      source: "bot",
    };
    store.entries = [entry];
    store.themes = [
      theme({ id: "open", title: "Тревога перед встречей", status: "active" }),
      theme({ id: "gone", title: "Убранная тема", status: "active", dismissed: true }),
    ];
    store.themeLinks = [{ entryId: "e1", themeId: "open", confidence: 0.9 }];
    const now = new Date(2026, 0, 8, 16, 0, 0);
    store.weekPreps = [
      {
        weekKey: therapyWindow(store.sessions, store.entries, THURSDAY, now, store.sessionPlan).weekKey,
        talkNotes: "",
        updatedAt: "2026-01-07T00:00:00.000Z",
        patternText: "Тревога перед встречами возвращается по утрам.",
      },
    ];
    const model = buildSessionPdfModel(store, "ru", THURSDAY, now);
    assert.match(model.patternText, /по утрам/);
    assert.equal(model.themes.some((item) => item.title === "Тревога перед встречей"), true);
    assert.equal(model.themes.some((item) => item.title === "Убранная тема"), false);
    assert.match(model.filename, /^between-.*\.pdf$/);
  });

  it("renders a pdf the bot can send", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const file = await renderSessionPdf(store, "ru", THURSDAY, new Date(2026, 0, 8, 16, 0, 0));
    assert.equal(Buffer.from(file.bytes.subarray(0, 5)).toString(), "%PDF-");
    assert.match(file.filename, /\.pdf$/);
  });
});
