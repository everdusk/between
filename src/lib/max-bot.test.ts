import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { digestChannel, maxUserIdFromDigest } from "./digest";
import { MAX_LAUNCH_BOOT_SCRIPT, maxClientFrom } from "./max-webapp";
import { runInNewContext } from "node:vm";
import { maxBotLinkUrl, maxBotLoginUrl, maxStorageId } from "./web-account";
import { toPublicAccount } from "./web-account-store";
import { RUSSIAN_TRUSTED_ROOT_CA, RUSSIAN_TRUSTED_SUB_CA } from "./max-ca";
import {
  feelingFromMaxPayload,
  isMaxPrivate,
  maxWebhookSecretMatches,
  maxWebhookSecretValue,
  maxAudioUrl,
  maxFeelingKeyboard,
  maxLoginKeyboard,
  maxOpenKeyboard,
  MAX_UPDATE_TYPES,
  maxText,
  maxUserId,
  type MaxUpdate,
} from "./max-bot";
import { parseFeelingCallback } from "./telegram-bot";

const previousUsername = process.env.MAX_BOT_USERNAME;

afterEach(() => {
  if (previousUsername === undefined) delete process.env.MAX_BOT_USERNAME;
  else process.env.MAX_BOT_USERNAME = previousUsername;
});

describe("MAX bot", () => {
  it("tells the site when MAX is linked and when it is not", () => {
    const base = {
      id: "w1",
      email: "a@b.co",
      salt: "s",
      hash: "h",
      telegramUserId: null,
      telegramUsername: null,
      maxUsername: null,
      createdAt: "",
      providers: {},
    };
    assert.equal(toPublicAccount({ ...base, maxUserId: null }).maxLinked, false);
    assert.equal(toPublicAccount({ ...base, maxUserId: 7 }).maxLinked, true);
    assert.equal(toPublicAccount({ ...base, maxUserId: null }).telegramLinked, false);
    assert.equal(toPublicAccount({ ...base, maxUserId: null }).hasPassword, true);
    assert.equal(toPublicAccount({ ...base, salt: "", hash: "", maxUserId: 7 }).hasPassword, false);
  });

  it("keeps a MAX user off the numeric Telegram journal key", () => {
    assert.equal(maxStorageId(42), "max:42");
    assert.equal(/^\d+$/.test(maxStorageId(42)), false);
    assert.equal(digestChannel("42"), "telegram");
    assert.equal(digestChannel("max:42"), "max");
    assert.equal(digestChannel("web:wabc"), null);
    assert.equal(maxUserIdFromDigest("max:42"), 42);
    assert.equal(maxUserIdFromDigest("42"), null);
  });

  it("builds a start link and refuses a nick that MAX would not accept", () => {
    process.env.MAX_BOT_USERNAME = "@se123_bot";
    assert.equal(maxBotLinkUrl("abcd2345"), "https://max.ru/se123_bot?start=link_abcd2345");
    process.env.MAX_BOT_USERNAME = "has space";
    assert.equal(maxBotLinkUrl("abcd2345"), null);
    process.env.MAX_BOT_USERNAME = "se14938561_bot";
    assert.equal(
      maxBotLoginUrl("abcdefghjkmnpqrstuvwxyz234567892"),
      "https://web.max.ru/se14938561_bot?start=login_abcdefghjkmnpqrstuvwxyz234567892",
    );
  });

  it("reads a private note, a mood tap, and a voice url", () => {
    const note: MaxUpdate = {
      update_type: "message_created",
      user_locale: "ru",
      message: {
        sender: { user_id: 7, is_bot: false },
        recipient: { chat_id: 7, chat_type: "dialog" },
        body: { text: "  мысль  " },
      },
    };
    assert.equal(isMaxPrivate(note), true);
    assert.equal(maxUserId(note), 7);
    assert.equal(maxText(note), "мысль");

    const group: MaxUpdate = {
      update_type: "message_created",
      message: {
        sender: { user_id: 7 },
        recipient: { chat_id: 99, chat_type: "chat" },
        body: { text: "в группе" },
      },
    };
    assert.equal(isMaxPrivate(group), false);

    const own: MaxUpdate = {
      update_type: "message_created",
      message: { sender: { user_id: 1, is_bot: true }, body: { text: "Записал." } },
    };
    assert.equal(maxUserId(own), null);

    const tap: MaxUpdate = {
      update_type: "message_callback",
      callback: { callback_id: "cb", payload: "c:e:2", user: { user_id: 7 } },
    };
    assert.deepEqual(feelingFromMaxPayload(tap.callback?.payload), parseFeelingCallback("c:e:2"));
    assert.equal(maxUserId(tap), 7);

    const voice: MaxUpdate = {
      update_type: "message_created",
      message: {
        sender: { user_id: 7 },
        recipient: { chat_id: 7, chat_type: "dialog" },
        body: { attachments: [{ type: "audio", payload: { url: "https://files.example/a.ogg" } }] },
      },
    };
    assert.equal(maxAudioUrl(voice), "https://files.example/a.ogg");
    assert.equal(maxAudioUrl({ message: { body: { attachments: [{ type: "image", payload: { url: "https://x" } }] } } }), null);
  });

  it("checks the webhook secret and refuses a missing one in production", () => {
    assert.equal(maxWebhookSecretMatches(null, undefined, "development"), true);
    assert.equal(maxWebhookSecretMatches(null, undefined, "production"), false);
    assert.equal(maxWebhookSecretMatches("right", " right "), true);
    assert.equal(maxWebhookSecretMatches("wrong", "right"), false);
    assert.equal(maxWebhookSecretMatches(null, "right"), false);
    const hashed = maxWebhookSecretValue("not a token");
    assert.equal(/^[a-f0-9]{64}$/.test(hashed), true);
    assert.equal(maxWebhookSecretMatches(hashed, "not a token"), true);
  });

  it("trusts the Russian CA that signs the MAX API", () => {
    assert.match(new X509Certificate(RUSSIAN_TRUSTED_ROOT_CA).subject, /Russian Trusted Root CA/);
    assert.match(new X509Certificate(RUSSIAN_TRUSTED_SUB_CA).subject, /Russian Trusted Sub CA/);
  });

  it("reads a MAX user id that arrived as text", () => {
    const started: MaxUpdate = { update_type: "bot_started", user: { user_id: Number("15") } };
    assert.equal(maxUserId({ ...started, user: { user_id: 15 } }), 15);
    assert.equal(maxUserId({ update_type: "bot_started", user: { user_id: "15" as unknown as number } }), 15);
    assert.equal(maxUserId({ update_type: "bot_stopped", user: { user_id: 15 } }), 15);
    assert.equal(isMaxPrivate({ update_type: "bot_stopped", user: { user_id: 15 } }), true);
    assert.equal(MAX_UPDATE_TYPES.includes("bot_stopped"), true);
  });

  it("puts the same callback payload on every mood button", () => {
    const keyboard = maxFeelingKeyboard("morning", "ru");
    const payloads = keyboard.payload.buttons.flat().map((button) =>
      button.type === "callback" ? button.payload : "",
    );
    assert.equal(payloads.length > 0, true);
    for (const payload of payloads) {
      assert.ok(parseFeelingCallback(payload));
    }
    assert.equal(keyboard.payload.buttons.every((row) => row.length <= 7), true);
  });

  it("opens Between through the MAX mini app, not the site webview", () => {
    process.env.MAX_BOT_USERNAME = "se14938561_bot";
    const keyboard = maxOpenKeyboard("ru");
    const button = keyboard?.payload.buttons[0][0];
    assert.equal(button?.type, "open_app");
    if (button?.type !== "open_app") return;
    assert.equal(button.web_app, "se14938561_bot");
    assert.equal("url" in button, false);
    const buy = keyboard?.payload.buttons[1][0];
    assert.equal(buy?.type, "link");
    if (buy?.type !== "link") return;
    assert.equal(buy.url, "https://www.between-journal.ru/subscribe");
  });

  it("keeps a callback button for an older sign-in message", () => {
    const keyboard = maxLoginKeyboard("abcdefghjkmnpqrstuvwxyz234567892", "ru");
    const button = keyboard.payload.buttons[0][0];
    assert.equal(button.type, "callback");
    if (button.type !== "callback") return;
    assert.equal(button.payload, "lin:abcdefghjkmnpqrstuvwxyz234567892");
    assert.equal(feelingFromMaxPayload(button.payload), null);
  });
});

describe("MAX client", () => {
  it("recognises the mini app, the MAX site, and the Android package", () => {
    assert.equal(maxClientFrom({}), false);
    assert.equal(maxClientFrom({ hash: "#WebAppPlatform=android&WebAppData=abc" }), true);
    assert.equal(maxClientFrom({ referrer: "https://web.max.ru/se14938561_bot" }), true);
    assert.equal(maxClientFrom({ referrer: "https://www.between-journal.ru/journal" }), false);
    assert.equal(maxClientFrom({ requestedWith: "ru.oneme.app" }), true);
    assert.equal(maxClientFrom({ cookie: true }), true);
  });

  it("tells MAX the page is ready and keeps the launch string", () => {
    const messages: string[] = [];
    const session = new Map<string, string>();
    const context = {
      location: { hash: "#WebAppData=signed&WebAppPlatform=web" },
      document: { referrer: "" },
      window: {},
      parent: {
        postMessage(data: string) {
          messages.push(data);
        },
      },
      sessionStorage: {
        setItem(key: string, value: string) {
          session.set(key, value);
        },
      },
      URLSearchParams,
      JSON,
    };
    runInNewContext(MAX_LAUNCH_BOOT_SCRIPT, context);
    assert.equal(session.get("WebAppData"), "signed");
    assert.equal(messages[0], JSON.stringify({ type: "WebAppReady" }));

    messages.length = 0;
    runInNewContext(MAX_LAUNCH_BOOT_SCRIPT, {
      ...context,
      location: { hash: "" },
      document: { referrer: "https://web.max.ru/se14938561_bot" },
    });
    assert.equal(messages[0], JSON.stringify({ type: "WebAppReady" }));

    messages.length = 0;
    runInNewContext(MAX_LAUNCH_BOOT_SCRIPT, {
      ...context,
      location: { hash: "" },
      document: { referrer: "https://www.between-journal.ru/" },
    });
    assert.equal(messages.length, 0);
  });

  it("signs in and starts the splash clock before the journal scripts load", () => {
    const calls: Array<{ url: string; body: string }> = [];
    const frame = {} as { __betweenMaxLogin?: Promise<unknown>; __betweenSplashAt?: number };
    runInNewContext(MAX_LAUNCH_BOOT_SCRIPT, {
      location: { hash: "#WebAppData=signed&WebAppPlatform=ios" },
      document: { referrer: "" },
      window: frame,
      parent: {
        postMessage() {},
      },
      sessionStorage: { setItem() {} },
      URLSearchParams,
      JSON,
      fetch(url: string, init: { body: string }) {
        calls.push({ url, body: init.body });
        return Promise.resolve({ ok: true, json: async () => ({ account: { email: "" } }) });
      },
      performance: { now: () => 42 },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "/api/account/max");
    assert.equal(calls[0]?.body, JSON.stringify({ initData: "signed" }));
    assert.equal(frame.__betweenSplashAt, 42);
    assert.ok(frame.__betweenMaxLogin instanceof Promise);

    const telegram = {} as { __betweenSplashAt?: number };
    runInNewContext(MAX_LAUNCH_BOOT_SCRIPT, {
      location: { hash: "#tgWebAppData=user%3D1&tgWebAppVersion=8" },
      document: { referrer: "" },
      window: telegram,
      parent: telegram,
      sessionStorage: { setItem() {} },
      URLSearchParams,
      JSON,
      performance: { now: () => 42 },
    });
    assert.equal(telegram.__betweenSplashAt, undefined);
  });
});
