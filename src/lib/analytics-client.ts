import { toDateKey } from "./dates";
import {
  clientMessenger,
  planAnalyticsSend,
  quietClientLaunch,
  type AnalyticsMessenger,
  type ClientAnalyticsEvent,
  type ProductPlan,
} from "./analytics-model";
import { readMaxInitData } from "./max-webapp";
import { captureProduct } from "./product-analytics";

export { clientMessenger };

const DEVICE_KEY = "between:device";
const QUIET_KEY = "between:analytics-quiet";

/** Telegram or MAX launch of the stats owner. The website learns the same fact from the server. */
export function clientAnalyticsQuiet(telegramInit = ""): boolean {
  if (typeof window === "undefined") return false;
  return quietClientLaunch({ telegramInit, maxInit: readMaxInitData() });
}

/** Launch identity, or a website session the server already marked. */
export function analyticsStaysQuiet(telegramInit = ""): boolean {
  return clientAnalyticsQuiet(telegramInit) || quietFlag();
}

function quietFlag(): boolean {
  try {
    return localStorage.getItem(QUIET_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberQuiet(response: Response): void {
  void response
    .json()
    .then((body: unknown) => {
      const quiet = Boolean(body && typeof body === "object" && (body as { quiet?: unknown }).quiet);
      try {
        if (quiet) localStorage.setItem(QUIET_KEY, "1");
        else localStorage.removeItem(QUIET_KEY);
      } catch {
        /* private mode */
      }
    })
    .catch(() => undefined);
}

function storageKeys(messenger: AnalyticsMessenger): { cohort: string; sent: string } {
  if (messenger === "web") {
    return { cohort: "between:analytics-cohort-web", sent: "between:analytics-sent-web" };
  }
  if (messenger === "max") {
    return { cohort: "between:analytics-cohort-max", sent: "between:analytics-sent-max" };
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
  if (clientAnalyticsQuiet(initData)) return;
  const maxInit = readMaxInitData();
  const messenger = clientMessenger(initData, maxInit);
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
  if (!quietFlag()) captureProduct(event, { ...(detail?.plan ? { plan: detail.plan } : {}), messenger });
  if (messenger === "telegram") {
    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": initData,
      },
      body: JSON.stringify({ event, cohort: plan.cohort, day: plan.day, messenger: "telegram" }),
      keepalive: true,
    })
      .then(rememberQuiet)
      .catch(() => undefined);
    return;
  }
  if (messenger === "max" && maxInit) {
    void fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Max-Init-Data": maxInit,
      },
      body: JSON.stringify({ event, cohort: plan.cohort, day: plan.day, messenger: "max" }),
      keepalive: true,
    })
      .then(rememberQuiet)
      .catch(() => undefined);
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
  })
    .then(rememberQuiet)
    .catch(() => undefined);
}
