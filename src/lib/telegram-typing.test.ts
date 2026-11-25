import assert from "node:assert/strict";
import { test } from "node:test";
import { startTelegramTyping } from "./telegram-bot";

test("sends and refreshes typing while a companion reply is pending", (t) => {
  const previousToken = process.env.BOT_TOKEN;
  process.env.BOT_TOKEN = "test-token";
  t.after(() => {
    if (previousToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = previousToken;
  });

  t.mock.timers.enable({ apis: ["setInterval"] });
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json({ ok: true, result: true });
  });

  const stop = startTelegramTyping(42);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/sendChatAction"));
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    chat_id: 42,
    action: "typing",
  });
  t.mock.timers.tick(4000);
  assert.equal(calls.length, 2);
  stop();
  assert.equal(calls[1].init?.signal?.aborted, true);
  t.mock.timers.tick(8000);
  assert.equal(calls.length, 2);
});
