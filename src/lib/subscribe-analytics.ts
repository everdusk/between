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
import { analyticsStaysQuiet } from "./analytics-client";
import { readMaxInitData } from "./max-webapp";

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

function readTelegramInitData(): string {
  if (typeof window === "undefined") return "";
  const match = /(?:^|#|&)tgWebAppData=([^&]*)/.exec(window.location.hash);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  const init = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp
    ?.initData;
  return init?.trim() ?? "";
}

/** One checkout step for the same person as the funnel. The server writes PostHog. `/stats` stays unchanged. */
export function captureSubscribe(input: {
  messenger: AnalyticsMessenger;
  step: SubscribeStep;
  plan?: ProductPlan;
  fail?: SubscribeFail;
}): void {
  if (typeof window === "undefined") return;
  if (analyticsStaysQuiet()) return;
  const properties = subscribeProperties(input);
  if (!properties) return;
  const maxInit = readMaxInitData();
  const telegramInit = readTelegramInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (input.messenger === "max" && maxInit) headers["X-Max-Init-Data"] = maxInit;
  else if (input.messenger === "telegram" && telegramInit) headers["X-Telegram-Init-Data"] = telegramInit;
  else {
    const device = deviceId();
    if (!device) return;
    headers["X-Between-Device"] = device;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers,
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      event: "subscribe",
      step: input.step,
      ...(properties.plan ? { plan: properties.plan } : {}),
      ...(properties.fail ? { fail: properties.fail } : {}),
    }),
  }).catch(() => undefined);
}
