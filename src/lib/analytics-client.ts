import { toDateKey } from "./dates";
import { planAnalyticsSend, type AnalyticsMessenger, type ClientAnalyticsEvent, type ProductPlan } from "./analytics-model";
import { captureProduct } from "./product-analytics";

const DEVICE_KEY = "between:device";

function storageKeys(messenger: AnalyticsMessenger): { cohort: string; sent: string } {
  if (messenger === "web") {
    return { cohort: "between:analytics-cohort-web", sent: "between:analytics-sent-web" };
  }
  return { cohort: "between:analytics-cohort", sent: "between:analytics-sent" };
}

function readState(messenger: AnalyticsMessenger): { cohort: string | null; sent: Record<string, string[]> } {
  const keys = storageKeys(messenger);
  const cohort = localStorage.getItem(keys.cohort);
  try {
    const raw = JSON.parse(localStorage.getItem(keys.sent) || "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { cohort, sent: {} };
    return { cohort, sent: raw as Record<string, string[]> };
  } catch {
    return { cohort, sent: {} };
  }
}

/** Random per browser. It never goes into a counter key; the server only hashes it. */
function deviceToken(): string | null {
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

/**
 * One funnel step per device per day.
 * A Telegram launch stays on `telegram_*`. An empty initData is the website and stays on `web_*`.
 */
export function trackAnalytics(
  event: ClientAnalyticsEvent,
  initData: string,
  detail?: { plan?: ProductPlan },
): void {
  if (typeof window === "undefined") return;
  const messenger: AnalyticsMessenger = initData ? "telegram" : "web";
  const keys = storageKeys(messenger);
  let plan: ReturnType<typeof planAnalyticsSend>;
  try {
    plan = planAnalyticsSend(readState(messenger), event, toDateKey());
    localStorage.setItem(keys.cohort, plan.state.cohort);
    localStorage.setItem(keys.sent, JSON.stringify(plan.state.sent));
  } catch {
    return;
  }
  if (!plan.send) return;
  captureProduct(event, { ...(detail?.plan ? { plan: detail.plan } : {}), messenger });
  if (messenger === "telegram") {
    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ event, cohort: plan.cohort, day: plan.day }),
      keepalive: true,
    }).catch(() => undefined);
    return;
  }
  const device = deviceToken();
  if (!device) return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Between-Device": device,
    },
    body: JSON.stringify({ event, cohort: plan.cohort, day: plan.day, messenger: "web" }),
    keepalive: true,
  }).catch(() => undefined);
}
