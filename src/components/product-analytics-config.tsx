"use client";

import { useLayoutEffect } from "react";
import { POSTHOG_BROWSER_KEY } from "@/lib/posthog-env";

/** Publishes the server-read project token before funnel effects run. */
export function ProductAnalyticsConfig({ token, host }: { token: string; host: string }) {
  useLayoutEffect(() => {
    if (!token.startsWith("phc_")) return;
    (window as unknown as Record<string, unknown>)[POSTHOG_BROWSER_KEY] = { token, host };
  }, [token, host]);
  return null;
}
