import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowBotChat } from "./bot-chat";

describe("bot chat permission", () => {
  it("shows the window on a Telegram open that has not allowed messages", () => {
    assert.equal(shouldShowBotChat({ inTelegram: true, allowsWriteToPm: false }), true);
    assert.equal(shouldShowBotChat({ inTelegram: true, allowsWriteToPm: true }), false);
    assert.equal(shouldShowBotChat({ inTelegram: false, allowsWriteToPm: false }), false);
  });
});
