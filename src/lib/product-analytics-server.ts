import { createHmac } from "node:crypto";
import { messengerEventName, type AnalyticsEvent, type AnalyticsMessenger } from "./analytics-model";
import { posthogBrowserConfig } from "./posthog-env";

/** One funnel step from a bot. The distinct id is a hash, not the messenger user id. */
export async function captureServerProduct(input: {
  messenger: AnalyticsMessenger;
  event: AnalyticsEvent;
  userId: number;
}): Promise<void> {
  const cfg = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!cfg || !pepper) return;
  const distinctId = createHmac("sha256", pepper)
    .update(`${input.messenger}:${input.userId}`)
    .digest("hex")
    .slice(0, 32);
  try {
    await fetch(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.token,
        event: messengerEventName(input.messenger, input.event),
        distinct_id: distinctId,
        properties: { messenger: input.messenger, $geoip_disable: true },
      }),
    });
  } catch {
    // PostHog being down does not change the journal.
  }
}
