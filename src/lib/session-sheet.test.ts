import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSessionPdfModel } from "./session-pdf";
import { applySessionSheet, prepareSessionSheet, type SessionSheetAsk } from "./session-sheet";
import { therapyWindow } from "./session-summary";
import { mergeStores } from "./journal-api";
import { normalizeStore } from "./migrate";
import { judgeStamp, patternFacts, patternKey, patternShouldRequest, pendingJudgeEntries, rankedThemes } from "./themes";
import { emptyStore, type JournalEntry, type SessionPlan, type SessionTheme } from "./types";

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
  it("keeps two independently evidenced topics through the API response, PDF, sync and a later edit", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    const body = "Снова снилась погоня. Боюсь потерять связь с другом.";
    store.entries = [note("two", body)];
    const topic = (id: string, title: string): SessionTheme => ({
      id, title, userId: "owner", summary: title, status: "active", reopened: false,
      dismissed: false, firstSeen: THURSDAY, lastSeen: THURSDAY, peakIntensity: 5,
      count: 0, confidence: 1, updatedAt: "2026-01-01T00:00:00.000Z", quotes: [],
    });
    store.themes = [topic("sleep", "Беспокойные сны"), topic("friend", "Страх потерять общение")];
    const classify = (quote: string) => JSON.stringify({
      relevant: true, match_theme: "sleep", confidence: 0.95, quote: "Снова снилась погоня",
      secondary: { theme_id: "friend", confidence: 0.91, quote },
    });
    const ask: SessionSheetAsk = async ({ kind }) => {
      assert.notEqual(kind, "dedup", "two evidenced aspects of one entry should stay separate");
      return { text: kind === "judge" ? classify("Боюсь потерять связь с другом") : null };
    };
    const sheet = await prepareSessionSheet(store, "ru", THURSDAY, NOW, "owner", ask);
    const saved = normalizeStore(applySessionSheet(store, sheet, NOW))!;
    assert.deepEqual(saved.themeLinks.map((link) => link.themeId).sort(), ["friend", "sleep"]);
    const pdf = buildSessionPdfModel(saved, "ru", THURSDAY, NOW);
    assert.ok(pdf.themes.length === 2 && pdf.themes.every((theme) => theme.notes[0]?.body === body));
    const edited = { ...saved, entries: [{ ...saved.entries[0], body: "Снова снилась погоня.", updatedAt: NOW.toISOString() }] };
    const later = new Date(NOW.getTime() + 1000);
    const next = await prepareSessionSheet(edited, "ru", THURSDAY, later, "owner", async ({ kind }) => ({
      text: kind === "judge" ? classify("Боюсь потерять связь с другом") : null,
    }));
    const current = applySessionSheet(edited, next, later);
    for (const synced of [mergeStores(saved, current), mergeStores(current, saved)]) {
      assert.deepEqual(synced.themeLinks.map((link) => link.themeId), ["sleep"]);
      assert.equal(synced.themes.find((theme) => theme.id === "friend")?.quotes.length, 0);
    }
  });

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
        stamp: patternKey(agenda, "ru", patternFacts(agenda, {
          entries: saved.entries, links: saved.themeLinks,
          dayKeys: therapyWindow(saved.sessions, saved.entries, THURSDAY, NOW, saved.sessionPlan).days,
        })),
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
        patternStamp: patternKey([], "ru"),
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

  it("refreshes the old voice without rejudging notes and saves it for the next PDF", async () => {
    const store = emptyStore();
    store.sessionPlan = weekly();
    store.entries = [note("e1", "Перед встречей снова тревожно и не могу собраться.")];
    const initial = await prepareSessionSheet(store, "ru", THURSDAY, NOW, "owner", async () => ({ text: null }));
    const saved = applySessionSheet(store, initial, NOW);
    saved.weekPreps[0].patternText = "В словах человека повторяется тревога перед встречей.";
    saved.weekPreps[0].patternStamp = "p:old:ru";
    const failed = await prepareSessionSheet(saved, "ru", THURSDAY, NOW, "owner", async () => ({ text: null }));
    assert.equal(failed.patternText, saved.weekPreps[0].patternText);
    assert.equal(failed.freshPattern, false);
    assert.equal(applySessionSheet(saved, failed, NOW).weekPreps[0].patternStamp, "p:old:ru");
    const calls: string[] = [];
    const text = "Перед встречами возвращается тревога. Возможно, ожидание разговора даётся сложнее самой встречи.";
    const refreshed = await prepareSessionSheet(saved, "ru", THURSDAY, NOW, "owner", async (input) => {
      calls.push(input.kind);
      return { text };
    });
    assert.deepEqual(calls, ["pattern"]);
    assert.equal(refreshed.patternText, text);
    const updated = applySessionSheet(saved, refreshed, new Date(NOW.getTime() + 1000));
    assert.equal(updated.weekPreps[0].patternText, text);
    assert.equal(updated.weekPreps[0].patternStamp, refreshed.patternStamp);
    const reused = await prepareSessionSheet(updated, "ru", THURSDAY, NOW, "owner", async () => {
      assert.fail("the refreshed pattern should be reused");
    });
    assert.equal(reused.patternText, text);
    // Even with unchanged theme metadata, edits to a source entry invalidate the paragraph.
    updated.entries[0].body += " Дополнительная важная деталь.";
    const newText = "Новый вывод учитывает дополненную запись перед встречей.";
    const changed = await prepareSessionSheet(updated, "ru", THURSDAY, NOW, "owner", async () => ({ text: newText }));
    assert.notEqual(changed.patternStamp, refreshed.patternStamp);
    assert.equal(applySessionSheet(updated, changed, new Date(NOW.getTime() + 2000)).weekPreps[0].patternText, newText);
    // A concurrently saved paragraph from the new prompt wins over an older PDF job.
    updated.weekPreps[0].patternText = "Более свежий вывод, сохранённый на вкладке недели.";
    assert.equal(applySessionSheet(updated, refreshed, NOW).weekPreps[0].patternText, updated.weekPreps[0].patternText);
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
