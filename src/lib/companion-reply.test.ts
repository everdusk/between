import assert from "node:assert/strict";
import { test } from "node:test";
import { retryContext, telegramReplyTarget } from "./companion-reply";
import { askCompanion } from "./companion-model";

const chat = { id: 17 };
const original = { chat, message_id: 23, from: { id: 18, is_bot: true },
  text: "Хочешь поговорить о работе? Или о переезде?\n\nКарточки · из базы получено 2, ответ без карточек" };
const message = { chat, from: { id: 17 }, reply_to_message: original };

test("a second attempt without Reply stays on the selected original, including old history", async () => {
  const source = "Умом понимаю, что письмо ещё не прочитали, но всё равно";
  const target = { author: "user" as const, messageId: 8, text: source };
  const first = retryContext("попробуй еще раз на этот вопрос ответить", target);
  assert.equal(first?.original, source);
  const previous = { user: "попробуй еще раз на этот вопрос ответить", reply: "Ты поверила, что всё плохо.",
    replyTo: { author: "user" as const, text: source } };
  const retry = retryContext("и еще раз попробуй", undefined, previous);
  assert.deepEqual(retry, { original: source, previousAnswer: previous.reply });
  assert.equal(retryContext("ответь заново", undefined,
    { user: "и еще раз попробуй", reply: "Какой-то другой ответ", retryOf: source })?.original, source);
  assert.equal(retryContext("Я хочу еще раз попробовать написать письмо", undefined, previous), undefined);
  assert.equal(retryContext("Попробуй еще раз найти письмо", undefined, previous), undefined);
  await askCompanion({
    apiKey: "test", base: "https://example.test", context: {}, message: "и еще раз попробуй", retry,
    read: raw => JSON.parse(raw),
    request: async (_url, init) => {
      const { messages } = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(messages[1].content).retry, retry);
      assert.ok(messages[0].content.includes("cbt-head-and-heart"));
      assert.ok(!messages[0].content.includes(previous.reply));
      assert.equal(messages[2].content, "и еще раз попробуй");
      return Response.json({choices: [{message: {content: '{"reply":"А что дальше?","usedCards":["cbt-head-and-heart"]}'}}]});
    },
  });
});

test("both search and generation receive the selected old message and exact excerpt", async () => {
  const replyTo = telegramReplyTarget({ ...message, quote: { text: "о переезде?", is_manual: true } });
  assert.deepEqual(replyTo, { author: "assistant", messageId: 23,
    text: "Хочешь поговорить о работе? Или о переезде?", quote: "о переезде?" });
  let requests = 0;
  await askCompanion({
    apiKey: "test", base: "https://example.test", knowledgeBaseId: "test",
    message: "Вот про это", context: { recent: [{user: "Как прошёл экзамен?", reply: "Уже есть оценки?"}] },
    replyTo, previousReply: replyTo?.quote, read: raw => JSON.parse(raw),
    request: async (url, init) => {
      if (String(url).endsWith("/search")) return Response.json({data: [{results: []}]});
      ++requests;
      const { messages } = JSON.parse(String(init?.body));
      assert.deepEqual(JSON.parse(messages[1].content).replyTo, replyTo);
      assert.equal(messages[2].content, "Вот про это");
      assert.ok(!messages[0].content.includes("о переезде?"));
      return Response.json({ choices: [{message: {content: '{"reply":"Хорошо"}'}}] });
    },
  });
  assert.equal(requests, 2);
});

test("reads the user's own caption and ignores automatic or ungrounded excerpts", () => {
  const own = { chat, message_id: 9, from: { id: 17 }, caption: "Здесь стало спокойнее" };
  const expected = { author: "user", messageId: 9, text: own.caption };
  assert.deepEqual(telegramReplyTarget({...message, reply_to_message: own}), expected);
  assert.deepEqual(telegramReplyTarget({...message, reply_to_message: own, quote: {text: "Здесь"}}), expected);
  assert.deepEqual(telegramReplyTarget({...message, reply_to_message: own, quote: {text: "придумано", is_manual: true}}), expected);
  assert.equal(telegramReplyTarget({...message, reply_to_message: {...own, chat: {id: 99}}}), undefined);
  assert.equal(telegramReplyTarget({...message, reply_to_message: {...own, forward_origin: {type: "user"}}}), undefined);
  assert.equal(telegramReplyTarget({chat, from: chat}), undefined);
});
