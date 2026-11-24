import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyStore } from "./types";
import {
  applyCompanionNotes,
  companionContext,
  readCompanionReply,
  type CompanionNote,
} from "./companion-memory";

const at = "2026-11-25T10:00:00Z",
  date = "2026-11-25";
const note: CompanionNote = {
  quote: "Боюсь отказать коллегам и снова беру чужую работу",
  detail: "Трудно отказаться от чужой работы",
  title: "Границы на работе",
  topicId: "",
  kind: "situation",
  beforeId: "",
  question: "",
};
test("explicit notes survive a model outage and redelivery; existing notes and settings stay intact", () => {
  const initial = emptyStore();
  const store = applyCompanionNotes(
    initial,
    "Запиши: без изменений!",
    [],
    11,
    date,
    at,
  );
  assert.equal(store.entries[0].body, "без изменений!");
  assert.deepEqual(store.notify, initial.notify);
  assert.deepEqual(
    applyCompanionNotes(store, "Запиши: без изменений!", [], 11, date, at),
    store,
  );
  assert.equal(
    applyCompanionNotes(store, "сварила суп", [], 12, date, at),
    store,
  );
});
test("memory retrieves an older note and accepts progress only with an earlier linked source", () => {
  let store = applyCompanionNotes(
    emptyStore(),
    note.quote,
    [note],
    11,
    "2026-07-01",
    "2026-07-01T10:00:00Z",
  );
  const first = store.entries[0];
  for (let i = 0; i < 10; i++)
    store = applyCompanionNotes(
      store,
      "Запиши: купила яблоки " + i,
      [],
      100 + i,
      date,
      at,
    );
  const context = companionContext(store, "Впервые смогла отказать коллегам");
  assert.ok(context.notes.some((n) => n.id === first.id));
  const changed = {
    ...note,
    kind: "progress",
    quote: "Впервые смогла отказать коллегам",
    topicId: store.themes[0].id,
    beforeId: first.id,
    detail: "В этот раз получилось отказаться",
  };
  const after = applyCompanionNotes(
    store,
    changed.quote,
    [changed],
    21,
    date,
    at,
  );
  assert.equal(after.themes.length, 1);
  assert.deepEqual(
    after.entries.find((e) => e.id === first.id),
    first,
  );
  assert.ok(
    after.themes[0].review?.some(
      (e) => e.kind === "observed" && e.beforeId === first.id,
    ),
  );
  const unrelated = applyCompanionNotes(
    store,
    changed.quote,
    [{ ...changed, beforeId: "companion-tg-101-0" }],
    22,
    date,
    at,
  );
  assert.ok(!unrelated.themes[0].review?.some((e) => e.kind === "observed"));
});
test("discard invented quotations, unknown source IDs and unsupported actions", () => {
  const result = readCompanionReply(
    JSON.stringify({ reply: "Расскажи подробнее", notes: [note] }),
    "Сегодня шёл дождь",
    companionContext(emptyStore(), "дождь"),
  );
  assert.deepEqual(result.notes, []);
  const parsed = readCompanionReply(
    JSON.stringify({
      reply: "Слышу",
      notes: [{ ...note, topicId: "invented", beforeId: "unknown" }],
    }),
    note.quote,
    companionContext(emptyStore(), note.quote),
  );
  assert.equal(parsed.notes[0].topicId, "");
  assert.equal(parsed.notes[0].beforeId, "");
});
