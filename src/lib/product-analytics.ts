import { scrubProductEvent, type AnalyticsEvent, type ProductPlan } from "./analytics-model";
import { readPosthogBrowserConfig } from "./posthog-env";

type PostHogClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
};

let booting: Promise<PostHogClient | null> | null = null;
let started = false;

function load(): Promise<PostHogClient | null> {
  const cfg = readPosthogBrowserConfig();
  if (!cfg) return Promise.resolve(null);
  if (!booting) {
    booting = import("posthog-js")
      .then(({ default: posthog }) => {
        const current = readPosthogBrowserConfig();
        if (!current) return null;
        if (!started) {
          started = true;
          posthog.init(current.token, {
            api_host: current.host,
            person_profiles: "identified_only",
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            capture_exceptions: false,
            capture_dead_clicks: false,
            capture_performance: false,
            rageclick: false,
            disable_session_recording: true,
            disable_surveys: true,
            advanced_disable_flags: true,
            persistence: "localStorage",
            before_send: (event) => scrubProductEvent(event) as typeof event | null,
          });
        }
        return posthog;
      })
      .catch(() => {
        booting = null;
        started = false;
        return null;
      });
  }
  return booting;
}

/** One funnel step in PostHog. No-op until the public project token is set. Never calls identify. */
export function captureProduct(event: AnalyticsEvent, detail?: { plan?: ProductPlan }): void {
  if (!readPosthogBrowserConfig()) return;
  const properties = detail?.plan ? { plan: detail.plan } : undefined;
  void load().then((posthog) => {
    posthog?.capture(event, properties);
  });
}
