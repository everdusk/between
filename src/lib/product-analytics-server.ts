import { createHmac } from "node:crypto";
import {
  PRODUCT_PLANS,
  messengerEventName,
  subscribeEventName,
  type AnalyticsEvent,
  type AnalyticsMessenger,
  type ProductPlan,
} from "./analytics-model";
import { posthogBrowserConfig } from "./posthog-env";

/**
 * PostHog person for a messenger user.
 * The bot and the mini app both use it, so one person who did either is one user.
 */
export function productDistinctId(
  pepper: string,
  messenger: AnalyticsMessenger,
  userId: number | string,
): string {
  return createHmac("sha256", pepper).update(`${messenger}:${userId}`).digest("hex").slice(0, 32);
}

/** One funnel step from the bot or the mini app. The distinct id is a hash, not the messenger user id. */
export async function captureServerProduct(input: {
  messenger: AnalyticsMessenger;
  event: AnalyticsEvent;
  userId: number | string;
  plan?: ProductPlan;
}): Promise<void> {
  const cfg = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!cfg || !pepper) return;
  const properties: Record<string, unknown> = { messenger: input.messenger, $geoip_disable: true };
  if (input.plan && (PRODUCT_PLANS as readonly string[]).includes(input.plan)) properties.plan = input.plan;
  try {
    await fetch(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.token,
        event: messengerEventName(input.messenger, input.event),
        distinct_id: productDistinctId(pepper, input.messenger, input.userId),
        properties,
      }),
    });
  } catch {
    // PostHog being down does not change the journal.
  }
}

/** A confirmed SBP charge. PostHog only: it does not move the `/stats` counters. */
export async function captureServerSubscribe(input: {
  messenger: AnalyticsMessenger;
  step: "paid" | "pending";
  plan: ProductPlan;
  actorId: string;
}): Promise<void> {
  const cfg = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!cfg || !pepper || !(PRODUCT_PLANS as readonly string[]).includes(input.plan)) return;
  const distinctId = productDistinctId(pepper, input.messenger, input.actorId);
  try {
    await fetch(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.token,
        event: subscribeEventName(input.messenger),
        distinct_id: distinctId,
        properties: {
          messenger: input.messenger,
          step: input.step,
          plan: input.plan,
          $geoip_disable: true,
        },
      }),
    });
  } catch {
    // A missed event does not change the payment.
  }
}
