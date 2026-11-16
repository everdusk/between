import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { sessionInviteDue } from "./session-invite";
import { sessionOpenKeyboard as telegramSessionKeyboard, sendTelegramWelcome } from "./telegram-bot";
import { sessionOpenKeyboard as maxSessionKeyboard } from "./max-bot";
import { emptyStore, type JournalEntry } from "./types";
import { welcomeCaption } from "./welcome-text";

const originalFetch = globalThis.fetch;
const originalToken = process.env.BOT_TOKEN;
const originalMaxName = process.env.MAX_BOT_USERNAME;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.BOT_TOKEN;
  else process.env.BOT_TOKEN = originalToken;
  if (originalMaxName === undefined) delete process.env.MAX_BOT_USERNAME;
  else process.env.MAX_BOT_USERNAME = originalMaxName;
});

describe("gentle bot introduction", () => {
  const now = new Date("2026-11-17T10:00:00Z");
  const note: JournalEntry = {
    id: "note", date: "2026-11-16", body: "Хочу сохранить мысль", source: "bot",
    createdAt: "2026-11-16T09:59:59Z", updatedAt: "2026-11-16T09:59:59Z", feelings: [], tags: [],
  };
  const input = () => ({ store: { ...emptyStore(), entries: [note] }, now, hour: 13, status: "trial" as const, paused: false });

  it("waits a full day after a written note, not a mood check-in or registration", () => {
    assert.equal(sessionInviteDue(input()), true);
    assert.equal(sessionInviteDue({ ...input(), now: new Date("2026-11-17T09:59:58Z") }), false);
    assert.equal(sessionInviteDue({ ...input(), store: emptyStore() }), false);
    for (const entry of [{ ...note, body: "  " }, { ...note, source: "checkin" as const }, { ...note, createdAt: "invalid" }]) {
      assert.equal(sessionInviteDue({ ...input(), store: { ...emptyStore(), entries: [entry] } }), false);
    }
  });

  it("respects service preferences, paid access, quiet hours and scheduled mood questions", () => {
    const base = input();
    assert.equal(sessionInviteDue({ ...base, store: { ...base.store, notify: { ...base.store.notify, serviceReminders: false } } }), false);
    assert.equal(sessionInviteDue({ ...base, store: { ...base.store, sessionPlan: { mode: "weekly", date: "", weekday: 1, time: "17:00", updatedAt: now.toISOString() } } }), false);
    assert.equal(sessionInviteDue({ ...base, paused: true }), false);
    for (const status of ["new", "locked"] as const) assert.equal(sessionInviteDue({ ...base, status }), false);
    for (const hour of [0, 8, 9, 14, 18, 21, 22, 23]) assert.equal(sessionInviteDue({ ...base, hour }), false);
  });

  it("links directly to session settings inside each messenger app", () => {
    const tg = telegramSessionKeyboard("https://example.com/journal?other=1", "ru");
    const url = new URL(tg.inline_keyboard[0][0].web_app.url);
    assert.equal(url.searchParams.get("tab"), "sessions");
    assert.equal(url.searchParams.get("other"), "1");
    process.env.MAX_BOT_USERNAME = "BetweenBot";
    assert.deepEqual(maxSessionKeyboard("ru")?.payload.buttons[0][0], {
      type: "open_app", text: "Настроить сеансы", web_app: "BetweenBot", payload: "sessions",
    });
    delete process.env.MAX_BOT_USERNAME;
    assert.equal(maxSessionKeyboard("ru"), null);
  });

  it("sends one text welcome inviting a note without a questionnaire or old flow image", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    process.env.BOT_TOKEN = "test-token";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init!.body as string) });
      return Response.json({ ok: true });
    };
    assert.equal(await sendTelegramWelcome(123, welcomeCaption("ru")), true);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/sendMessage"));
    assert.match(calls[0].body.text as string, /Оставьте первую заметку/);
    assert.doesNotMatch(calls[0].body.text as string, /задам.*вопрос|Работаете ли вы/);
    assert.equal(calls[0].body.reply_markup, undefined);
  });
});
