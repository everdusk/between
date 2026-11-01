const DEFAULT_HOST = "https://eu.i.posthog.com";

export const POSTHOG_BROWSER_KEY = "__BETWEEN_POSTHOG__";

export type PosthogBrowserConfig = { token: string; host: string };

/**
 * Public project token only (`phc_…`).
 * `POSTHOG_KEY` stays on the server. A personal key (`phx_…`) never reaches the browser.
 */
export function posthogBrowserConfig(input: {
  key?: string | null;
  host?: string | null;
}): { token: string; host: string } | null {
  const token = input.key?.trim() ?? "";
  if (!token.startsWith("phc_") || token.length < 12 || /[\s"'<>]/.test(token)) return null;
  return { token, host: posthogHost(input.host) };
}

export function readPosthogBrowserConfig(): PosthogBrowserConfig | null {
  if (typeof window === "undefined") return null;
  const raw = (window as unknown as Record<string, unknown>)[POSTHOG_BROWSER_KEY];
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { token?: unknown; host?: unknown };
  return posthogBrowserConfig({
    key: typeof value.token === "string" ? value.token : "",
    host: typeof value.host === "string" ? value.host : "",
  });
}

function posthogHost(value: string | null | undefined): string {
  const raw = value?.trim().replace(/\/$/, "") || DEFAULT_HOST;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return DEFAULT_HOST;
    return url.origin;
  } catch {
    return DEFAULT_HOST;
  }
}
