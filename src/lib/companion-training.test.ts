import assert from "node:assert/strict";
import { test } from "node:test";
import { applyTesterEdit, proposeTesterRule, testerEdit, type TesterInstructions } from "./companion-training";
import { askCompanion } from "./companion-model";

test("an ordinary correction stays in conversation; text and dictated feedback are explicit", () => {
  assert.equal(testerEdit("Нет, ты не так понял"), undefined);
  assert.equal(testerEdit("Она сказала: «Правка: задай вопрос»"), undefined);
  for (const text of ["Правка: дай пример", "Правка боту. Дай пример", "Правка боту дай пример"]) {
    assert.equal(testerEdit(text)?.kind, "propose");
  }
});

test("drafts need confirmation, stale clicks cannot overwrite a rule and approved rules can be edited or removed", async () => {
  const state: TesterInstructions = { rules: [], nextId: 1 };
  const edit = (text: string, id: number, action?: string) =>
    applyTesterEdit(state, testerEdit(text, action)!, id, async feedback => feedback);
  await edit("Правка: Первое предложение.", 7);
  const draft = await edit("Правка: Второе предложение.", 8);
  assert.deepEqual(state.rules, []);
  await edit("", 9, "ci:rule:accept:7");
  assert.deepEqual(state.rules, []);
  const accept = draft.rows![0][0].data;
  await edit("", 10, accept);
  await edit("", 11, accept);
  assert.deepEqual(state.rules, [{ id: 1, text: "Второе предложение." }]);
  await edit("Измени правило 1: Новая версия.", 12);
  await edit("", 13, "ci:rule:cancel:12");
  assert.match((await edit("Мои правила", 14)).text, /Второе предложение/);
  await edit("Измени правило №1: Новая версия.", 15);
  await edit("", 16, "ci:rule:accept:15");
  assert.deepEqual(state.rules, [{ id: 1, text: "Новая версия." }]);
  await edit("Удали правило 1", 17);
  assert.deepEqual(state.rules, []);
  assert.doesNotMatch((await edit("Мои правила", 18)).text, /Новая версия/);
});

test("bulk clear is opt-in, invalidates drafts, and stale buttons cannot clear new rules", async () => {
  const state: TesterInstructions = { rules: [{ id: 1, text: "Первое" }], nextId: 2 };
  const edit = (text: string, id: number, action?: string) =>
    applyTesterEdit(state, testerEdit(text, action)!, id, async feedback => feedback);
  const list = await edit("Мои правила", 1);
  const prompt = await edit("", 2, list.rows![0][0].data);
  await edit("", 3, prompt.rows![0][1].data);
  assert.equal(state.rules.length, 1);
  const old = await edit("Очистить мои правила", 4);
  const draft = await edit("Правка: Второе", 5);
  await edit("", 6, old.rows![0][0].data);
  assert.equal(state.rules.length, 1);
  const current = await edit("Очистить мои правила", 7);
  await edit("", 8, current.rows![0][0].data);
  await edit("", 9, draft.rows![0][0].data);
  assert.deepEqual(state.rules, []);
  const fresh = await edit("Правка: Новое", 10);
  await edit("", 11, fresh.rows![0][0].data);
  await edit("", 12, current.rows![0][0].data);
  assert.deepEqual(state.rules, [{ id: 2, text: "Новое" }]);
});

test("tester preferences reach hosted search and fallback, while urgent and ordinary accounts omit them", async () => {
  const rule = "При просьбе привести пример дай одну конкретную фразу.";
  for (const [urgent, enabled] of [[false, true], [true, true], [false, false]]) {
    let calls = 0;
    await askCompanion({
      apiKey: "test", base: "https://example.test", context: {}, message: "Привет",
      testerRules: enabled ? [rule] : undefined, urgent, knowledgeBaseId: "test", read: JSON.parse,
      request: async (_, init) => {
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(JSON.parse(body.messages[1].content).testerRules, enabled && !urgent ? [rule] : undefined);
        assert.ok(!body.messages[0].content.includes(rule));
        calls++;
        if (body.tools) return new Response(null, { status: 400 });
        return Response.json({ choices: [{ message: { content: "{}" } }] });
      },
    });
    assert.equal(calls, urgent ? 1 : 2);
  }
});

test("the draft editor sees only the selected example and can ask for clarification", async () => {
  const example = { feedback: "не поняла", reply: "Что ты имеешь в виду?" };
  const rule = await proposeTesterRule("test", "https://example.test", example, async (_, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.tools, undefined);
    assert.deepEqual(JSON.parse(body.messages[1].content), example);
    return Response.json({ choices: [{ message: { content: "NEED_DETAIL" } }] });
  });
  assert.equal(rule, null);
});
