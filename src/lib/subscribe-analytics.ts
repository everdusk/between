import {
  PRODUCT_PLANS,
  SUBSCRIBE_FAILS,
  SUBSCRIBE_STEPS,
  parseSubscribeEvent,
  subscribeEventName,
  type AnalyticsMessenger,
  type ProductPlan,
  type SubscribeFail,
  type SubscribeStep,
} from "./analytics-model";
import { readPosthogBrowserConfig } from "./posthog-env";

export { parseSubscribeEvent, subscribeEventName };
export type { SubscribeFail, SubscribeStep };

const DEVICE_KEY = "between:device";

/** Properties safe to leave the device. Anything else, including an email, is dropped. */
export function subscribeProperties(input: {
  messenger: AnalyticsMessenger;
  step: string;
  plan?: string | null;
  fail?: string | null;
}): Record<string, string> | null {
  if (!(SUBSCRIBE_STEPS as readonly string[]).includes(input.step)) return null;
  const properties: Record<string, string> = { messenger: input.messenger, step: input.step };
  if (input.plan && (PRODUCT_PLANS as readonly string[]).includes(input.plan)) {
    properties.plan = input.plan;
  }
  if (
    input.step === "pay_fail" &&
    input.fail &&
    (SUBSCRIBE_FAILS as readonly string[]).includes(input.fail)
  ) {
    properties.fail = input.fail;
  }
  return properties;
}

export function subscribeFail(error: string | undefined): SubscribeFail {
  if (error === "auth" || error === "not_configured" || error === "bad_payment") return error;
  return "rejected";
}

function deviceId(): string | null {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing && /^[a-z0-9]{32}$/.test(existing)) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(DEVICE_KEY, token);
    return token;
  } catch {
    return null;
  }
}

/** One PostHog event. It does not touch the `/stats` counters. No-op until the public token is on the page. */
export function captureSubscribe(input: {
  messenger: AnalyticsMessenger;
  step: SubscribeStep;
  plan?: ProductPlan;
  fail?: SubscribeFail;
}): void {
  if (typeof window === "undefined") return;
  const properties = subscribeProperties(input);
  if (!properties) return;
  const cfg = readPosthogBrowserConfig();
  const distinctId = deviceId();
  if (cfg && distinctId) {
    const body = JSON.stringify({
      api_key: cfg.token,
      event: subscribeEventName(input.messenger),
      distinct_id: distinctId,
      properties: { ...properties, $geoip_disable: true },
    });
    void fetch(`${cfg.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}
