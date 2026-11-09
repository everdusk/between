import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrubProductEvent } from "./analytics-model";
import { parseSubscribeEvent, subscribeEventName, subscribeFail, subscribeProperties } from "./subscribe-analytics";

describe("subscribe analytics", () => {
  it("keeps the step and the plan, and drops the receipt address", () => {
    assert.equal(subscribeEventName("web"), "web_subscribe");
    assert.equal(parseSubscribeEvent("max_subscribe"), "max");
    assert.equal(parseSubscribeEvent("web_paid"), null);
    assert.deepEqual(subscribeProperties({ messenger: "web", step: "plan", plan: "year" }), {
      messenger: "web",
      step: "plan",
      plan: "year",
    });
    assert.equal(subscribeProperties({ messenger: "web", step: "nope" }), null);
    assert.deepEqual(
      subscribeProperties({ messenger: "telegram", step: "pay", plan: "forever", fail: "auth" }),
      { messenger: "telegram", step: "pay" },
    );
    assert.deepEqual(
      subscribeProperties({ messenger: "web", step: "pay_fail", plan: "month", fail: "network" }),
      { messenger: "web", step: "pay_fail", plan: "month", fail: "network" },
    );
    assert.equal(subscribeFail("not_configured"), "not_configured");
    assert.equal(subscribeFail("card declined for masha@example.ru"), "rejected");

    const kept = scrubProductEvent({
      event: "web_subscribe",
      properties: {
        distinct_id: "a".repeat(32),
        step: "pay",
        plan: "quarter",
        fail: "auth",
        email: "masha@example.ru",
        url: "https://qr.nspk.ru/AS1",
      },
    });
    assert.equal(kept?.event, "web_subscribe");
    assert.equal(kept?.properties?.step, "pay");
    assert.equal(kept?.properties?.plan, "quarter");
    assert.equal(kept?.properties?.messenger, "web");
    assert.equal(kept?.properties?.fail, undefined);
    assert.equal(kept?.properties?.email, undefined);
    assert.equal(kept?.properties?.url, undefined);
    assert.equal(JSON.stringify(kept).includes("masha"), false);
    assert.equal(JSON.stringify(kept).includes("nspk"), false);
  });
});
