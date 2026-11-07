import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { digestChannel, maxUserIdFromDigest } from "./digest";
import { maxClientFrom } from "./max-webapp";
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

  it("checks the webhook secret only when one is set", () => {
    assert.equal(maxWebhookSecretMatches(null, undefined), true);
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
});
