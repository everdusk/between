import { createHmac } from "node:crypto";
import {
  PRODUCT_PLANS,
  SUBSCRIBE_FAILS,
  SUBSCRIBE_STEPS,
  messengerEventName,
  subscribeEventName,
  type AnalyticsEvent,
  type AnalyticsMessenger,
  type ProductPlan,
  type SubscribeFail,
  type SubscribeStep,
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

/** A checkout action. PostHog only: it does not move the `/stats` counters. Same person as the funnel. */
export async function captureServerSubscribe(input: {
  messenger: AnalyticsMessenger;
  step: SubscribeStep;
  plan?: ProductPlan | null;
  fail?: SubscribeFail | null;
  actorId: string | number;
}): Promise<void> {
  if (!(SUBSCRIBE_STEPS as readonly string[]).includes(input.step)) return;
  const cfg = posthogBrowserConfig({
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST,
  });
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim();
  if (!cfg || !pepper) return;
  const properties: Record<string, unknown> = {
    messenger: input.messenger,
    step: input.step,
    $geoip_disable: true,
  };
  if (input.plan && (PRODUCT_PLANS as readonly string[]).includes(input.plan)) properties.plan = input.plan;
  if (
    input.step === "pay_fail" &&
    input.fail &&
    (SUBSCRIBE_FAILS as readonly string[]).includes(input.fail)
  ) {
    properties.fail = input.fail;
  }
  try {
    await fetch(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: cfg.token,
        event: subscribeEventName(input.messenger),
        distinct_id: productDistinctId(pepper, input.messenger, input.actorId),
        properties,
      }),
    });
  } catch {
    // A missed event does not change the payment.
  }
}
