import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSessionPdfModel } from "./session-pdf";
import { applySessionSheet, prepareSessionSheet, type SessionSheetAsk } from "./session-sheet";
import { therapyWindow } from "./session-summary";
import { judgeStamp, patternKey, patternShouldRequest, pendingJudgeEntries, rankedThemes } from "./themes";
import { emptyStore, type JournalEntry, type SessionPlan } from "./types";

const THURSDAY = "2026-01-08";
const NOW = new Date(2026, 0, 8, 16, 0, 0);

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

function note(id: string, body: string): JournalEntry {
  return {
    id,
    date: "2026-01-07",
    createdAt: "2026-01-07T08:00:00.000Z",
    updatedAt: "2026-01-07T08:00:00.000Z",
    body,
    feelings: ["тревожно"],
    tags: [],
    source: "app",
  };
}

describe("session sheet without a week visit", () => {
  it("builds a pattern and a backlog for the file and leaves the journal alone", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const body = "Перед встречей снова тревожно и не могу собраться.";
    store.entries = [note("e1", body)];
    const calls: string[] = [];
    const ask: SessionSheetAsk = async (input) => {
      calls.push(input.kind);
      if (input.kind === "judge") {
        return {
          text: JSON.stringify({
            relevant: true,
            match_theme: null,
            intensity: 8,
            new_theme: { title: "Тревога перед встречей" },
            confidence: 0.9,
            quote: "Перед встречей снова тревожно",
            reason: "повтор",
          }),
        };
      }
      if (input.kind === "pattern") return { text: "Тревога перед встречами возвращается по утрам." };
      return { text: null };
    };
    const sheet = await prepareSessionSheet(store, "ru", THURSDAY, NOW, "owner", ask);
    assert.deepEqual(calls, ["judge", "pattern"]);
    assert.equal(sheet.themes.some((theme) => theme.title === "Тревога перед встречей"), true);
    assert.equal(sheet.patternText, "Тревога перед встречами возвращается по утрам.");
    assert.equal(store.themes.length, 0);
    assert.equal(store.weekPreps.length, 0);
    const saved = applySessionSheet(store, sheet, NOW);
    assert.equal(saved.themes.some((theme) => theme.title === "Тревога перед встречей"), true);
    assert.equal(saved.weekPreps[0]?.patternText, "Тревога перед встречами возвращается по утрам.");
    assert.equal(saved.judgeSettled.includes(judgeStamp(store.entries[0])), true);
    assert.equal(pendingJudgeEntries(saved.entries, saved.judgeSettled ?? [], ["2026-01-07"]).length, 0);
    const agenda = rankedThemes(saved.themes ?? [], THURSDAY, []);
    assert.equal(
      patternShouldRequest({
        hasInitData: true,
        disabled: false,
        judging: false,
        themeCount: agenda.length,
        hasWords: true,
        savedStamp: saved.weekPreps[0]?.patternStamp,
        stamp: patternKey(agenda, "ru"),
        savedText: saved.weekPreps[0]?.patternText ?? "",
        gaveUp: false,
        inFlight: false,
      }),
      false,
    );
    assert.equal(applySessionSheet(saved, sheet, NOW).themes.length, saved.themes.length);
    const model = buildSessionPdfModel(store, "ru", THURSDAY, NOW, sheet);
    assert.match(model.patternText, /по утрам/);
    assert.equal(model.themes.some((theme) => theme.title === "Тревога перед встречей"), true);
  });

  it("keeps a pattern the week tab already saved when every note is judged", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const entry = note("e1", "Перед встречей снова тревожно и не могу собраться.");
    store.entries = [entry];
    store.judgeSettled = [judgeStamp(entry)];
    store.weekPreps = [
      {
        weekKey: therapyWindow(store.sessions, store.entries, THURSDAY, NOW, store.sessionPlan).weekKey,
        talkNotes: "",
        updatedAt: "2026-01-07T00:00:00.000Z",
        patternText: "Уже сохранённый паттерн недели.",
      },
    ];
    let called = false;
    const sheet = await prepareSessionSheet(store, "ru", THURSDAY, NOW, "owner", async () => {
      called = true;
      return { text: null };
    });
    assert.equal(called, false);
    assert.equal(sheet.patternText, "Уже сохранённый паттерн недели.");
  });

  it("still names a theme when the model is silent", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    store.entries = [note("e1", "Перед встречей снова тревожно и не могу собраться с мыслями.")];
    const sheet = await prepareSessionSheet(store, "ru", THURSDAY, NOW, "owner", async () => ({ text: null }));
    assert.equal(sheet.themes.length > 0, true);
    assert.match(sheet.patternText, /Перед встречей/);
    assert.equal(store.themes.length, 0);
  });
});
