import { toDateKey } from "./dates";
import { planAnalyticsSend, type ClientAnalyticsEvent, type ProductPlan } from "./analytics-model";
import { captureProduct } from "./product-analytics";

const COHORT_KEY = "between:analytics-cohort";
const SENT_KEY = "between:analytics-sent";

function readState(): { cohort: string | null; sent: Record<string, string[]> } {
  const cohort = localStorage.getItem(COHORT_KEY);
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) || "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { cohort, sent: {} };
    return { cohort, sent: raw as Record<string, string[]> };
  } catch {
    return { cohort, sent: {} };
  }
}

/** Counts one funnel step per device per day. No Telegram id leaves the validated request. */
export function trackAnalytics(
  event: ClientAnalyticsEvent,
  initData: string,
  detail?: { plan?: ProductPlan },
): void {
  if (!initData || typeof window === "undefined") return;
  let plan: ReturnType<typeof planAnalyticsSend>;
  try {
    plan = planAnalyticsSend(readState(), event, toDateKey());
    localStorage.setItem(COHORT_KEY, plan.state.cohort);
    localStorage.setItem(SENT_KEY, JSON.stringify(plan.state.sent));
  } catch {
    return;
  }
  if (!plan.send) return;
  captureProduct(event, detail?.plan ? { plan: detail.plan } : undefined);
  void fetch("/api/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify({ event, cohort: plan.cohort, day: plan.day }),
    keepalive: true,
  }).catch(() => undefined);
}
