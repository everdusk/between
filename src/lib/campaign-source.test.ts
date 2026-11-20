import assert from "node:assert/strict";
import { it } from "node:test";
import { telegramCampaignSource } from "./campaign-source";
import { captureServerCampaignStart, productDistinctId } from "./product-analytics-server";

it("only accepts public Telegram campaign labels, never login tokens or Yandex refs", () => {
  assert.equal(telegramCampaignSource("tg_telegain_to4nopsy")?.campaign_name, "to4nopsy");
  assert.deepEqual(telegramCampaignSource("tg_ads_en_01"), {
    campaign_source: "telegram", campaign_medium: "sponsored_message",
    campaign_platform: "telegram_ads", campaign_name: "en_01", campaign_tag: "tg_ads_en_01",
  });
  for (const payload of [null, "", "app", "login_secret", "link_secret", `ad_${"a".repeat(32)}`, "tg_telegain_", "tg_telegain_private@email.ru", `tg_telegain_${"a".repeat(60)}`]) {
    assert.equal(telegramCampaignSource(payload), null);
  }
});

it("captures tagged starts as the same PostHog person, excludes owners, and survives outages", async () => {
  const keys = ["POSTHOG_KEY", "POSTHOG_HOST", "BOT_TOKEN", "ANALYTICS_OWNERS"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const calls: { event: string; distinct_id: string; properties: Record<string, unknown> }[] = [];
  process.env.POSTHOG_KEY = "phc_publictoken12";
  process.env.POSTHOG_HOST = "https://us.i.posthog.com";
  process.env.BOT_TOKEN = "test-pepper";
  process.env.ANALYTICS_OWNERS = "owner";
  globalThis.fetch = async (_url, init) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response("{}", { status: 200 });
  };
  const start = { payload: "tg_telegain_to4nopsy", messenger: "telegram" as const, userId: 42 };
  try {
    await captureServerCampaignStart(start);
    await captureServerCampaignStart({ ...start, username: "owner" });
    await captureServerCampaignStart({ ...start, payload: "login_secret" });
    await captureServerCampaignStart({ ...start, messenger: "max" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].event, "telegram_campaign_start");
    assert.equal(calls[0].distinct_id, productDistinctId("test-pepper", "telegram", 42));
    assert.equal(calls[0].properties.campaign_tag, start.payload);
    assert.equal(calls[0].properties.campaign_source, "telegram");
    assert.deepEqual(calls[0].properties.$set_once, { first_tagged_campaign: start.payload });
    assert.equal(JSON.stringify(calls).includes("login_secret"), false);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.doesNotReject(captureServerCampaignStart(start));
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
