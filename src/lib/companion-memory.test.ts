import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyStore } from "./types";
import { buildWeekSpectrum } from "./spectrum";
import { askCompanion } from "./companion-model";
import {
  applyCompanionNotes,
  companionContext,
  companionEntryPatch,
  emptyCompanion,
  readCompanionReply,
  recentCompanionNotes,
  recentMoodCheckin,
  type CompanionNote,
} from "./companion-memory";

const at = "2026-11-25T10:00:00Z",
  date = "2026-11-25";

test("a fresh mood selection gives context only to the next nearby turn", () => {
  const store = applyCompanionNotes(emptyStore(), "Запиши: встреча", [], 42, date, at);
  store.entries[0] = { ...store.entries[0], source: "checkin", feelings: ["напряжение"], body: "" };
  const next = "2026-11-25T10:05:00Z";
  assert.equal(recentMoodCheckin(store, emptyCompanion(), next), "напряжение");
  assert.equal(recentMoodCheckin(store, emptyCompanion(), "2026-11-25T15:00:00Z"), undefined);
  assert.equal(recentMoodCheckin(store, {
    ...emptyCompanion(), conversation: { lastTurnAt: next, notes: [] },
  }, next), undefined);
});

test("reads the JSON envelope returned by a live Luna file search and validates proposed notes", () => {
  const inner = {
    reply: "Как всё прошло?",
    notes: ["Недостоверная запись"],
    followUp: "",
  };
  const response = readCompanionReply(
    JSON.stringify({ answer: JSON.stringify(inner) }),
    "Всё получилось",
    { topics: [], notes: [] },
  );
  assert.equal(response.reply, inner.reply);
  assert.deepEqual(response.notes, []);
  assert.throws(() =>
    readCompanionReply('{"answer":"just text"}', "тест", {
      topics: [],
      notes: [],
    }),
  );
});
const note: CompanionNote = {
  quote: "Боюсь отказать коллегам и снова беру чужую работу",
  detail: "Трудно отказаться от чужой работы",
  title: "Границы на работе",
  topicId: "",
  kind: "situation",
  beforeId: "",
  question: "",
};

test("the active app topic index does not depend on chat vocabulary or the five detail slots", () => {
  const store = applyCompanionNotes(emptyStore(), note.quote, [note], 1, date, at);
  const original = store.themes[0];
  store.themeLinks = []; // Older journals can link a source through its quote alone.
  store.themes.push(...Array.from({ length: 7 }, (_, i) => ({
    ...original, manual: true, id: "app-" + i, title: "Запрос " + i,
    quotes: [], summary: "", count: 0,
  })));
  store.themes.push({ ...original, id: "removed", dismissed: true, dismissedAt: at });
  const previous = { user: "Стоит ли брать выходной?", reply: "Давай подумаем." };
  for (const text of ["Пройдись по темам", "Какие у меня там тeмы?", "да"]) {
    const diary = companionContext(store, text, previous);
    assert.deepEqual(diary.topics.map(t => t.id), store.themes.slice(0, -1).map(t => t.id));
  }
  const diary = companionContext(store, "Пройдись по темам", previous);
  assert.ok(diary.notes.some(e => e.id === store.entries[0].id && e.topicIds?.includes(original.id)));
});

test("attaches the inferred feeling to its own entry and counts it once in the spectrum", () => {
  const quote = "Лежу и перебираю всё, что завтра может пойти не так.";
  const other = "На пятницу назначили встречу.";
  const text = quote + " " + other;
  const context = { topics: [], notes: [] };
  const raw = JSON.stringify({
    reply: "Как давно это началось?",
    notes: [
      { ...note, quote, feeling: "тревожно", feelingQuote: "перебираю всё, что завтра может пойти не так" },
      { ...note, quote: other, feeling: "тревожно", feelingQuote: "перебираю всё" },
    ],
  });
  const { notes } = readCompanionReply(raw, text, context);
  const saved = applyCompanionNotes(emptyStore(), text, notes, 12, date, at);
  assert.deepEqual(saved.entries.find((e) => e.body === quote)?.feelings, ["тревожно"]);
  assert.deepEqual(saved.entries.find((e) => e.body === other)?.feelings, []);
  assert.equal(saved.entries.length, 2);
  assert.deepEqual(buildWeekSpectrum([date], saved.entries).shares, [
    { feeling: "тревожно", count: 1 },
  ]);
});

test("explicit saves can attach a feeling grounded in the requested text, including the previous turn", () => {
  const body = "Получилось! Весь вечер хожу улыбаюсь.";
  const raw = JSON.stringify({
    reply: "🤍",
    notes: [{ ...note, quote: body, feeling: "радость", feelingQuote: "хожу улыбаюсь" }],
  });
  const direct = "Запиши: " + body;
  const context = { topics: [], notes: [] };
  for (const parsed of [
    readCompanionReply(raw, direct, context),
    readCompanionReply(raw, "запиши это", context, body),
  ]) {
    const saved = applyCompanionNotes(emptyStore(), direct, parsed.notes, 13, date, at);
    assert.equal(saved.entries[0].body, body);
    assert.deepEqual(saved.entries[0].feelings, ["радость"]);
  }
  assert.deepEqual(readCompanionReply(raw, "запиши это", context, "").notes, []);
});

test("appends a development to the same recent companion note without duplicating it", () => {
  const added = applyCompanionNotes(
    emptyStore(),
    note.quote,
    [note],
    1,
    date,
    at,
  );
  const entry = added.entries[0];
  const later = "2026-11-25T10:20:00Z";
  const tracked = [{ id: entry.id, updatedAt: entry.updatedAt }];
  const state = {
    ...emptyCompanion(),
    conversation: { lastTurnAt: at, notes: tracked },
  };
  assert.deepEqual(recentCompanionNotes(state, later), tracked);
  assert.deepEqual(recentCompanionNotes(state, "2026-11-25T11:00:00Z"), []);
  assert.equal(
    companionContext(added, "Сегодня спала плохо", undefined, tracked).notes[0]
      .id,
    entry.id,
  );

  const followUp = "Сегодня мне предложили взять ещё один проект";
  const development = {
    ...note,
    kind: "development",
    quote: followUp,
    beforeId: entry.id,
    topicId: added.themes[0].id,
  };
  const updated = applyCompanionNotes(
    added,
    followUp,
    [development],
    2,
    date,
    later,
    tracked,
  );
  assert.equal(updated.entries.length, 1);
  assert.equal(updated.entries[0].id, entry.id);
  assert.equal(updated.entries[0].body, entry.body + "\n\n" + followUp);
  assert.deepEqual(
    companionEntryPatch(added.entries, updated.entries),
    updated.entries,
  );
  assert.deepEqual(updated.themeLinks, added.themeLinks);
  assert.equal(updated.themes[0].count, added.themes[0].count);
  assert.equal(
    applyCompanionNotes(
      updated,
      followUp,
      [development],
      2,
      date,
      later,
      tracked,
    ),
    updated,
  );
  const removed = { ...added, entries: [], droppedEntryIds: [entry.id] };
  assert.equal(
    applyCompanionNotes(
      removed,
      followUp,
      [development],
      2,
      date,
      later,
      tracked,
    ),
    removed,
  );
  const edited = {
    ...added,
    entries: [{ ...entry, body: "Исправлено вручную", updatedAt: later }],
  };
  assert.equal(
    applyCompanionNotes(
      edited,
      followUp,
      [development],
      2,
      date,
      later,
      tracked,
    ),
    edited,
  );
});

test("retries Luna without JSON mode after the provider rejects the format or returns no answer", async () => {
  for (const firstResponse of [
    new Response(null, { status: 400 }),
    Response.json({ choices: [{ message: { content: "" } }] }),
  ]) {
    const calls: RequestInit[] = [];
    const reply = await askCompanion({
      apiKey: "test",
      base: "https://example.test/v1",
      context: { recent: [] },
      message: "Тест сообщения",
      read: (raw) =>
        readCompanionReply(raw, "Тест сообщения", { topics: [], notes: [] }),
      request: async (_, init) => {
        calls.push(init!);
        return calls.length === 1
          ? firstResponse
          : Response.json({
              choices: [
                {
                  message: {
                    content:
                      '\x60\x60\x60json\n{"reply":"Привет"}\n\x60\x60\x60',
                  },
                },
              ],
            });
      },
    });
    assert.equal(reply.reply, "Привет");
    assert.deepEqual(reply.notes, []);
    assert.equal(calls.length, 2);
    const [first, retry] = calls.map((call) => JSON.parse(String(call.body)));
    assert.deepEqual(first.response_format, { type: "json_object" });
    assert.deepEqual(first.messages.slice(1), [
      { role: "user", content: JSON.stringify({ recent: [] }) },
      { role: "user", content: "Тест сообщения" },
    ]);
    assert.deepEqual(retry.messages, first.messages);
    assert.equal(retry.response_format, undefined);
    assert.equal(retry.model, "gpt-6-luna");
    assert.equal(retry.max_tokens, 4096);
    assert.deepEqual(first.reasoning, { effort: "medium", exclude: true });
    assert.deepEqual(retry.reasoning, first.reasoning);
    assert.equal(calls[0].signal, calls[1].signal);
  }
});

test("does not retry an AITUNNEL permission failure", async () => {
  let attempts = 0;
  await assert.rejects(
    askCompanion({
      apiKey: "test",
      base: "https://example.test/v1",
      context: {},
      message: "Тест сообщения",
      read: () => null,
      request: async () => {
        attempts++;
        return new Response(null, { status: 403 });
      },
    }),
    /http_403/,
  );
  assert.equal(attempts, 1);
});
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
test("companion replies and follow-ups omit em dashes while diary quotes keep their punctuation", () => {
  const text = "Планы — это важно";
  const parsed = readCompanionReply(JSON.stringify({
    reply: "Понимаю — это важно.", followUp: "Как ты — получилось отдохнуть?",
    notes: [{ kind: "situation", quote: text }],
  }), text, { topics: [], notes: [] });
  assert.ok(!parsed.reply.includes("—"));
  assert.ok(!parsed.followUp.includes("—"));
  assert.equal(parsed.notes[0].quote, text);
});
