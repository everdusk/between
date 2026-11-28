import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyStore, type SessionTheme, type TherapyStore } from "./types";
import { buildWeekSpectrum } from "./spectrum";
import { askCompanion } from "./companion-model";
import {
  applyCompanionNotes,
  applyCompanionMerge,
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

test("repairs duplicated noun endings in generated prose without editing diary evidence", () => {
  const text = "После сообщениящения я еле-еле успокоилась.";
  const raw = JSON.stringify({
    reply: "У этого ожиданиядания есть конец. Ты сказала «сообщениящения». Еле-еле, ожидания, понимание.",
    notes: [{ kind: "situation", quote: text, detail: text }],
  });
  const answer = readCompanionReply(raw, text, { topics: [], notes: [] });
  assert.equal(answer.reply, "У этого ожидания есть конец. Ты сказала «сообщениящения». Еле-еле, ожидания, понимание.");
  assert.equal(answer.notes[0].quote, text);
});

test("grounds a chat merge in two linked notes and the new message, including turns with no new note", () => {
  const texts = ["Беру чужие смены, боюсь подвести коллег", "Делаю отчёт за коллег, боюсь подвести отдел"];
  const store: TherapyStore = emptyStore();
  for (const [i, body] of texts.entries()) {
    const entryId = "note-" + i, topicId = "topic-" + i;
    store.entries.push({ id: entryId, date, createdAt: at, updatedAt: at, source: "app", body, feelings: [], tags: [] });
    const theme: SessionTheme = {
      id: topicId, userId: "local", title: i ? "Чужие отчёты" : "Лишние смены", summary: "",
      status: "active", count: 1, confidence: 1, firstSeen: date, lastSeen: date, peakIntensity: 5,
      reopened: false, dismissed: false, quotes: [], updatedAt: at,
      review: [{ id: "review-" + i, kind: "note", text: body, at }],
    };
    store.themes.push(theme);
    store.themeLinks.push({ entryId, themeId: topicId, confidence: 1 });
  }
  const signal = "И со сменами, и с отчётами боюсь подвести коллег";
  const context = companionContext(store, signal);
  const raw = {
    relation: "same_pattern", confidence: 0.92, signal,
    left: { topicId: "topic-0", entryId: "note-0", quote: texts[0] },
    right: { topicId: "topic-1", entryId: "note-1", quote: texts[1] },
  };
  const proposal = (topicMerge = raw, text = signal) =>
    readCompanionReply(JSON.stringify({ reply: "Понимаю", topicMerge }), text, context).merge;
  const merge = proposal();
  assert.ok(merge);
  const after = applyCompanionMerge(store, merge, at);
  assert.equal(after.entries, store.entries);
  assert.equal(after.themes.length, 1);
  assert.equal(after.themes[0].count, 2);
  assert.equal(after.themes[0].review?.length, 2);
  assert.deepEqual(after.themes[0].mergedIds, ["topic-1"]);
  assert.ok(after.themeLinks.every(l => l.themeId === "topic-0"));
  assert.equal(companionContext(after, "Да", { user: "", reply: "", topicId: "topic-1" }).discussionTopicId, "topic-0");
  assert.equal(applyCompanionMerge(after, merge, at), after);
  const legacy: TherapyStore = {
    ...store, themeLinks: [],
    themes: store.themes.map((t, i) => ({
      ...t, manual: i === 1, quotes: [{ entryId: "note-" + i, date, intensity: 5, text: texts[i] }],
    })),
  };
  const keptManual = applyCompanionMerge(legacy, merge, at);
  assert.deepEqual(keptManual.themes.map(t => t.title), [legacy.themes[1].title]);
  assert.deepEqual(keptManual.themeLinks.map(l => l.themeId), ["topic-1", "topic-1"]);
  assert.equal(keptManual.themes[0].count, 2);
  assert.equal(proposal({ ...raw, right: { ...raw.right, quote: "вымышленная деталь" } }), undefined);
  assert.equal(proposal({ ...raw, right: { ...raw.right, entryId: "note-0" } }), undefined);
  assert.equal(proposal({ ...raw, relation: "same_emotion" }), undefined);
  assert.equal(proposal({ ...raw, confidence: 0.6 }), undefined);
  assert.equal(proposal(raw, "Это другая история"), undefined);
  assert.equal(proposal(raw, signal + ", но не объединяй темы"), undefined);
  for (const changed of [
    { ...store, droppedEntryIds: ["note-0"] },
    { ...store, entries: store.entries.filter(e => e.id !== "note-0") },
    { ...store, themeLinks: [] },
    { ...store, themes: store.themes.map(t => ({ ...t, manual: true })) },
    { ...store, themes: store.themes.map(t => ({ ...t, status: "discussed" as const })) },
    { ...store, themes: store.themes.map(t => ({ ...t, dismissed: true })) },
    { ...store, themes: store.themes.map((t, i) => ({ ...t, list: i ? "therapy" as const : "personal" as const })) },
  ]) assert.equal(applyCompanionMerge(changed, merge, at), changed);
});

test("a fresh mood selection gives context only to the next nearby turn", () => {
  const store = applyCompanionNotes(emptyStore(), "Запиши: встреча", [], 42, date, at);
  store.entries[0] = { ...store.entries[0], source: "checkin", feelings: ["напряжение"], body: "" };
  const next = "2026-11-25T10:05:00Z";
  assert.equal(recentMoodCheckin(store, emptyCompanion(), next)?.feeling, "напряжение");
  assert.equal(recentMoodCheckin(store, emptyCompanion(), "2026-11-25T15:00:00Z"), undefined);
  assert.equal(recentMoodCheckin(store, {
    ...emptyCompanion(), conversation: { lastTurnAt: next, notes: [] },
  }, next), undefined);
});

test("an older poll answered a minute ago supplies the actual check-in question", () => {
  const store = applyCompanionNotes(emptyStore(), "Запиши: отметка", [], 42, date, at);
  store.entries[0] = { ...store.entries[0], source: "checkin", feelings: ["стыд"], body: "",
    createdAt: "2026-11-25T14:00:00Z", updatedAt: "2026-11-25T16:00:00Z" };
  const context = recentMoodCheckin(store, emptyCompanion(), "2026-11-25T16:01:00Z");
  assert.equal(context?.feeling, "стыд");
  assert.match(context?.botReplyRu ?? "", /Хочется рассказать, что случилось\?/);
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

test("retries Gemma without JSON mode after the provider rejects the format or returns no answer", async () => {
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
      { role: "user", content: "{}" },
      { role: "user", content: "Тест сообщения" },
    ]);
    assert.deepEqual(retry.messages, first.messages);
    assert.equal(retry.response_format, undefined);
    assert.equal(retry.model, "gemma-4-31b-it");
    assert.equal(retry.max_tokens, 4096);
    assert.equal(first.reasoning_effort, "medium");
    assert.equal(retry.reasoning_effort, first.reasoning_effort);
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

test("moving to the next saved topic loads linked entries and keeps them on a short follow-up", () => {
  const store = applyCompanionNotes(emptyStore(), note.quote, [note], 19, date, at);
  const old = store.themes[0];
  const focus = { ...old, id: "delivery", title: "Первый заказ", quotes: [], summary: "Заказ пришёл вовремя", manual: true };
  const bodies = ["Договорились на пятницу", "На встрече было спокойно", "В следующий раз попрошу образец"];
  const entries = bodies.map((body, i) => ({...store.entries[0], id: "source-" + i, body}));
  store.entries.push(...entries);
  store.themes.push({ ...old, id: "hidden", dismissed: true }, focus);
  store.themeLinks.push(...entries.slice(0, 2).map(e => ({...store.themeLinks[0], themeId: focus.id, entryId: e.id})));
  store.themes[2].quotes = [{...old.quotes[0], entryId: entries[2].id}];
  const turn = {user: "Что дальше?", reply: "Поговорим про " + old.title + "?"};
  const next = companionContext(store, "Не знаю. Давай к следующей теме перейдём", turn);
  assert.equal(next.discussionTopicId, focus.id);
  for (const entry of entries) assert.ok(next.notes.some(n => n.text === entry.body && n.topicIds?.includes(focus.id)));
  const parsed = readCompanionReply(JSON.stringify({ reply: "Как прошло в пятницу?", discussionTopicId: focus.id }), "давай", next);
  const following = { user: "давай", reply: parsed.reply, topicId: parsed.topicId };
  store.droppedEntryIds = [entries[0].id];
  const yes = companionContext(store, "да", following);
  assert.equal(yes.discussionTopicId, focus.id);
  const legacy = companionContext(store, "И вчера тоже", { user: "Да, помню", reply: "Как это было?" }, [],
    [{ user: "Давай дальше", reply: "Следующая тема: Первый заказ. Расскажешь?" }]);
  assert.equal(legacy.discussionTopicId, focus.id);
  assert.ok(legacy.notes.some(n => n.topicIds?.includes(focus.id)));
  assert.equal(yes.notes.filter(n => n.topicIds?.includes(focus.id)).length, 2);
  assert.ok(yes.notes.every(n => n.id !== entries[0].id));
  assert.equal(companionContext(store, "Перейдём к следующей", following).endOfTopics, true);
  assert.equal(companionContext(store, "Поговорим о другом", following).discussionTopicId, undefined);
  assert.equal(companionContext(store, "Покажи мои темы", following).discussionTopicId, undefined);
  assert.equal(companionContext(store, "Точно", { ...following, topicId: null }).discussionTopicId, undefined);
});
