import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { launchSection, sessionTabUrl, weekTabUrl } from "./launch-section";

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
    assert.equal(weekTabUrl("https://www.between-journal.ru"), "https://www.between-journal.ru/?tab=week");
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
});
