import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { launchSection, sessionTabUrl } from "./launch-section";
import { sessionPlanKeyboard as maxSessionKeyboard } from "./max-bot";
import { sessionPlanKeyboard } from "./telegram-bot";

describe("session tab launch", () => {
  it("adds the sessions tab to the mini app url", () => {
    assert.equal(
      sessionTabUrl("https://www.between-journal.ru"),
      "https://www.between-journal.ru/?tab=sessions",
    );
    assert.equal(
      sessionTabUrl("https://www.between-journal.ru/journal?lang=ru"),
      "https://www.between-journal.ru/journal?lang=ru&tab=sessions",
    );
  });

  it("reads the tab from the query, the start parameter, and the launch string", () => {
    assert.equal(launchSection({ search: "?tab=sessions" }), "sessions");
    assert.equal(launchSection({ search: "?tab=week" }), "week");
    assert.equal(launchSection({ search: "?tab=nope" }), null);
    assert.equal(launchSection({ hash: "#tgWebAppStartParam=sessions" }), "sessions");
    assert.equal(launchSection({ search: "?WebAppStartParam=sessions" }), "sessions");
    assert.equal(
      launchSection({ hash: "#WebAppData=" + encodeURIComponent("user=%7B%7D&start_param=sessions") }),
      "sessions",
    );
    assert.equal(launchSection({ startParam: "sessions" }), "sessions");
    assert.equal(launchSection({ initData: "user=%7B%7D&start_param=week" }), "week");
    assert.equal(launchSection({}), null);
  });

  it("points the telegram button at the sessions tab", () => {
    const board = sessionPlanKeyboard("https://www.between-journal.ru", "ru");
    const button = board.inline_keyboard[0][0];
    assert.equal(button.text, "Поставить дату");
    assert.equal(button.web_app.url, "https://www.between-journal.ru/?tab=sessions");
  });

  it("passes sessions as the MAX mini app payload", () => {
    process.env.MAX_BOT_USERNAME = "se14938561_bot";
    const keyboard = maxSessionKeyboard("ru");
    const button = keyboard?.payload.buttons[0][0];
    assert.equal(button?.type, "open_app");
    if (button?.type !== "open_app") return;
    assert.equal(button.payload, "sessions");
    assert.match(button.payload, /^[A-Za-z0-9_-]+$/);
    assert.equal(button.web_app, "se14938561_bot");
    assert.equal(maxSessionKeyboard("en")?.payload.buttons[0][0].text, "Set the date");
  });
});
