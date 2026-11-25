import assert from "node:assert/strict";
import { test } from "node:test";
import { askCompanion } from "./companion-model";
import { companionPrompt } from "./companion-prompt";
import { findPractice } from "./companion-practices";

test("chooses a practice from the current intent, using the previous question for a short answer", () => {
  const previous = "Есть кто-то конкретный, чьей реакции ты опасаешься?";
  const cases = [
    ["Ну есть один друг от чьего мнения я завишу", "judgment"],
    ["Мама", "judgment"],
    ["Ты меня не понял, я боюсь осуждения", "repair"],
    ["Он тогда высмеял мою работу", "hurt"],
    ["Помоги написать ему сообщение", "wording"],
    ["Я всё-таки отправила письмо", "return"],
    ["Без советов, просто хочу выговориться", "listen"],
    ["Да", undefined],
    ["Мама купила цветы", undefined],
    ["Запиши: я опять себя накручиваю", undefined],
  ] as const;
  for (const [message, expected] of cases) {
    assert.equal(findPractice(message, previous)?.id, expected, message);
  }
  assert.equal(findPractice("Мама")?.id, undefined);
});

test("adds only the retrieved guidance to the model prompt and leaves diary context in user data", async () => {
  const context = { recent: [], diary: { notes: [{ text: "Старая запись" }] } };
  const message = "Как отказать коллеге?";
  const card = findPractice(message)!;
  assert.equal(card.id, "wording");
  for (const urgent of [false, true]) {
    await askCompanion({
      apiKey: "test",
      base: "https://example.test",
      message,
      context,
      urgent,
      read: JSON.parse,
      request: async (_, init) => {
        const { messages } = JSON.parse(String(init?.body));
        assert.equal(messages[0].content.startsWith(companionPrompt), true);
        assert.equal(messages[0].content.includes(card.guidance), !urgent);
        assert.equal(messages[0].content.includes("Старая запись"), false);
        assert.deepEqual(messages.slice(1), [
          { role: "user", content: JSON.stringify(context) },
          { role: "user", content: message },
        ]);
        return Response.json({ choices: [{ message: { content: "{}" } }] });
      },
    });
  }
});
