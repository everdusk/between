/** Query and start-parameter values that open a journal tab. */
export const LAUNCH_SECTIONS = ["journal", "week", "sessions", "subscribe"] as const;

export type LaunchSection = (typeof LAUNCH_SECTIONS)[number];

const LAUNCH_SECTION_SET = new Set<string>(LAUNCH_SECTIONS);

/** Mini App URL that lands on the session date. */
export function sessionTabUrl(base: string): string {
  return tabUrl(base, "sessions");
}

/** Mini App URL that lands on the week. */
export function weekTabUrl(base: string): string {
  return tabUrl(base, "week");
}

/** Mini App URL that opens the subscription sheet. */
export function subscribeTabUrl(base: string): string {
  return tabUrl(base, "subscribe");
}

function tabUrl(base: string, tab: LaunchSection): string {
  const url = new URL(base);
  url.searchParams.set("tab", tab);
  return url.toString();
}

/**
 * Tab requested by `?tab=`, a Telegram/MAX start parameter, or `start_param`
 * inside a launch string. Anything else stays on the journal.
 */
export function launchSection(input: {
  search?: string;
  hash?: string;
  startParam?: string | null;
  initData?: string | null;
}): LaunchSection | null {
  const search = readParams(input.search);
  const hash = readParams(input.hash);
  const candidates = [
    input.startParam,
    search.get("tab"),
    search.get("tgWebAppStartParam"),
    search.get("WebAppStartParam"),
    hash.get("tgWebAppStartParam"),
    hash.get("WebAppStartParam"),
    startParamFromLaunch(input.initData),
    startParamFromLaunch(hash.get("tgWebAppData")),
    startParamFromLaunch(hash.get("WebAppData")),
  ];
  for (const value of candidates) {
    if (value && LAUNCH_SECTION_SET.has(value)) return value as LaunchSection;
  }
  return null;
}

function readParams(raw: string | undefined): URLSearchParams {
  const text = (raw ?? "").replace(/^[?#]/, "");
  try {
    return new URLSearchParams(text);
  } catch {
    return new URLSearchParams();
  }
}

function startParamFromLaunch(launch: string | null | undefined): string | null {
  if (!launch) return null;
  try {
    return new URLSearchParams(launch).get("start_param");
  } catch {
    return null;
  }
}
