import assert from "node:assert/strict";
import { test } from "node:test";
import { rememberAddress } from "./companion-address";
import { emptyCompanion, readCompanionReply } from "./companion-memory";
import { askCompanion } from "./companion-model";

test("recovers the user's form from legacy history and keeps it after history rolls off", () => {
  const legacy = emptyCompanion();
  legacy.gender = "masculine";
  legacy.recent.push({
    user: "Я вчера проснулась от шума",
    reply: "Ты устал?",
  });
  rememberAddress(legacy, "Сегодня всё нормально");
  assert.equal(legacy.gender, "feminine");

  const reopened = JSON.parse(JSON.stringify({ ...legacy, recent: [] }));
  for (const text of [
    "На работе хорошо",
    "Брат сказал: «Я решил уехать»",
    "А у тебя?",
  ]) {
    rememberAddress(reopened, text);
    assert.equal(reopened.gender, "feminine");
  }
});

test("explicit address wins over ordinary grammar until the user changes it", () => {
  const state = emptyCompanion();
  rememberAddress(state, "Я решил написать");
  assert.equal(state.gender, "masculine");
  rememberAddress(state, "Пожалуйста, обращайся ко мне в женском роде");
  rememberAddress(state, "Я решил");
  assert.equal(state.gender, "feminine");
  rememberAddress(state, "Используй мужской род, пожалуйста.");
  assert.equal(state.gender, "masculine");
});

test("neutral text, someone else's words and the bot's replies give no preference", () => {
  const state = emptyCompanion();
  state.recent.push({ user: "Саша", reply: "Рада тебя видеть!" });
  for (const text of [
    "Я думаю о маме",
    "«Я устал», — написал друг.",
    "Если бы она решила",
  ]) {
    rememberAddress(state, text);
    assert.equal(state.gender, undefined);
  }
});

test("model-only evidence for an unfamiliar verb must come from the speaker", () => {
  const text = "Подруга пишет: «я уволилась»";
  const payload = JSON.stringify({
    reply: "Привет",
    gender: "feminine",
    genderQuote: "я уволилась",
  });
  const diary = { topics: [], notes: [] };
  assert.equal(readCompanionReply(payload, text, diary).gender, undefined);
  assert.equal(
    readCompanionReply(payload, "сегодня я уволилась", diary).gender,
    "feminine",
  );
});

test("every hosted-search and fallback request carries the persisted address", async () => {
  let calls = 0;
  await askCompanion({
    gender: "feminine",
    message: "Привет",
    previousReply: "Как дела?",
    context: { recent: [] },
    knowledgeBaseId: "test",
    apiKey: "test",
    base: "https://example.test",
    read: raw => JSON.parse(raw),
    request: async (_, init) => {
      const { messages } = JSON.parse(String(init?.body));
      assert.match(messages[0].content, /в женском роде/);
      assert.equal(messages[0].role, "system");
      if (++calls < 3) return new Response(null, { status: 400 });
      return Response.json({
        choices: [{ message: { content: '{"reply":"Привет!"}' } }],
      });
    },
  });
  assert.equal(calls, 3);
});
