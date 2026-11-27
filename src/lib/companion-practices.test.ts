import assert from "node:assert/strict";
import { test } from "node:test";
import { askCompanion } from "./companion-model";
import { companionPrompt } from "./companion-prompt";
import { findPractice } from "./companion-practices";
import { practiceFooter } from "./companion-search";

test("the search runs even if the model skips or rejects the requested tool call", async () => {
  for (const rejectTool of [false, true]) {
    let calls = 0;
    await askCompanion({
      apiKey: "test",
      base: "https://example.test",
      knowledgeBaseId: "kb_test",
      message: "Мне трудно решить, как к этому относиться",
      context: {},
      read: raw => JSON.parse(raw),
      request: async (url, init) => {
        const body = JSON.parse(String(init?.body));
        if (String(url).endsWith("/search")) {
          assert.equal(++calls, 2);
          return Response.json({data: [{results: []}]});
        }
        if (++calls === 1) {
          assert.equal(body.tools[0].function.name, "search_practices");
          assert.equal(body.tool_choice.function.name, "search_practices");
          if (rejectTool) return new Response(null, { status: 400 });
        } else {
          assert.deepEqual(body.response_format, { type: "json_object" });
          assert.equal(body.tools, undefined);
          assert.equal(calls, 3);
        }
        return Response.json({
          choices: [
            {
              message: {
                content: '{"reply":"Привет","notes":[],"followUp":""}',
              },
            },
          ],
        });
      },
    });
    assert.equal(calls, 3);
  }
});

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
    ["У всех вышло, а у меня нет", "self-judgment"],
    ["у других получилось а у меня нет", "self-judgment"],
    ["Сравниваю себя с однокурсниками", "self-judgment"],
    ["Я сравневаю себя с другими", "self-judgment"],
    ["Мои ровесники уже открыли студии, а я всё ещё учусь", "self-judgment"],
    ["Ровесники уже нашли квартиру", undefined],
    ["У всех вышло обновление, а у меня нет", undefined],
    ["Без советов. У всех вышло, а у меня нет", "listen"],
  ] as const;
  for (const [message, expected] of cases) {
    assert.equal(findPractice(message, previous)?.id, expected, message);
  }
  assert.equal(findPractice("Мама")?.id, undefined);
});

test("recognises comparisons and attributes only cited sources from the actual generation request", async () => {
  for (const explicit of [true, false]) {
    let searches = 0, generations = 0;
    const footer = await askCompanion({
      apiKey: "test", base: "https://example.test", knowledgeBaseId: "kb_test",
      context: {}, message: explicit ? "У всех вышло, а у меня нет" : "Как смотреть на это по-другому?",
      read: (raw, cards, failed) => practiceFooter(JSON.parse(raw).usedCards, cards, failed),
      request: async (url, init) => {
        const body = JSON.parse(String(init?.body));
        if (String(url).endsWith("/kb_test/search")) {
          searches++;
          assert.match(body.query, /сравнение себя/i);
          return Response.json({data: [{ results: [
            { path: "books/cbt-double-standard.md", text: "books/cbt-double-standard.md — Двойной стандарт\n\nТекст карточки" },
          ] }]});
        }
        if (body.tools) return Response.json({choices: [{message: {tool_calls: [{function: {
          name: "search_practices", arguments: JSON.stringify({query: "сравнение себя с ровесниками"}),
        }}]}}]});
        generations++;
        assert.equal(JSON.parse(body.messages[1].content).practiceCards[0].id, "cbt-double-standard");
        return Response.json({choices: [{message: {content: '{"reply":"Отклик","usedCards":["cbt-double-standard","invented"]}'}}]});
      },
    });
    assert.equal(searches, 1);
    assert.equal(generations, 1);
    assert.equal(footer, "Карточки ответа · Двойной стандарт (из базы получено 1)");
  }
});

test("the comparison conversation consults the index on each continuation, including a one-word answer", async () => {
  const turns = [
    ["Когда я вроде трачу столько же времени а результат хуже", "Что для тебя значит разрыв в результатах?"],
    ["Странный вопрос. Разрыв в результатах приводит к выводу", "Что делает вывод о таланте убедительным в этом разрыве результатов?"],
    ["Ну факт разницы", "Ты сравниваешь себя с людьми, у которых был похожий старт?"],
    ["Да", "В первую очередь предыдущий опыт или одинаковое время?"],
    ["Если есть предыдущий опыт, то легче. Если условия полностью одинаковые, то сложно", "Спасибо"],
  ];
  for (const [i, [message]] of turns.entries()) {
    const [previousMessage, previousReply] = turns[i - 1] ?? [];
    const calls: string[] = [];
    const status = await askCompanion({
      apiKey: "test", base: "https://example.test", knowledgeBaseId: "kb_test",
      context: {}, message, previousMessage, previousReply,
      read: (_, __, status) => status,
      request: async (url, init) => {
        calls.push(String(url).split("/").at(-1)!);
        const body = JSON.parse(String(init?.body));
        if (String(url).endsWith("/search")) {
          assert.match(body.query, /сравнение себя/i);
          return Response.json({data: [{results: []}]});
        }
        assert.equal(body.tools, undefined);
        return Response.json({choices: [{message: {content: "{}"}}]});
      },
    });
    assert.equal(status, 0);
    assert.deepEqual(calls, ["search", "completions"], message);
  }
});

test("closing, saving, or an urgent turn does not inherit the previous comparison search", async () => {
  for (const [message, urgent] of [["Спасибо!", false], ["Запиши: про работу", false], ["Да", true]] as const) {
    await askCompanion({apiKey: "test", base: "https://example.test", knowledgeBaseId: "kb_test",
      context: {}, previousReply: "Ты сравниваешь себя с людьми?", message, urgent,
      read: (_, cards, status) => { assert.deepEqual(cards, []); assert.equal(status, "skipped"); },
      request: async (url, init) => {
        assert.ok(String(url).endsWith("/completions"));
        assert.equal(JSON.parse(String(init?.body)).tools, undefined);
        return Response.json({choices: [{message: {content: "{}"}}]});
      },
    });
  }
});

test("an unavailable index still allows a grounded local source or a candid empty trace", async () => {
  await askCompanion({
    apiKey: "test", base: "https://example.test", knowledgeBaseId: "kb_test",
    context: {}, message: "У всех вышло, а у меня нет",
    request: async url => String(url).endsWith("/search") ? new Response(null, {status: 503}) :
      Response.json({ choices: [{message: {content: "{}"}}] }),
    read: (_, cards, failed) => {
      assert.equal(failed, "failed");
      assert.match(practiceFooter(["self-judgment"], cards, failed), /Самокритика/);
      assert.match(practiceFooter(["unknown"], cards, failed), /поиск недоступен/);
      assert.equal(practiceFooter([], cards, 2), "Карточки · из базы получено 2, ответ без карточек");
      assert.match(practiceFooter(undefined, cards, "skipped"), /не подтверждён/);
    },
  });
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
      read: raw => JSON.parse(raw),
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
