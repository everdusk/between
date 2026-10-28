import type { ThemeParams, WebApp, WebAppUser } from "@twa-dev/types";

export type TelegramSession = {
  ready: boolean;
  inTelegram: boolean;
  user: WebAppUser | null;
  displayName: string;
  colorScheme: "light" | "dark";
  viewportStableHeight: number | null;
  /** Raw WebApp initData for server auth; empty outside Telegram. */
  initData: string;
};

export const DEV_DISPLAY_NAME = "Гость";

export function isLikelyTelegram(webApp: WebApp): boolean {
  return Boolean(webApp.initData) || Boolean(webApp.initDataUnsafe?.user);
}

export function displayNameFromUser(user: WebAppUser | null | undefined): string {
  if (!user) return DEV_DISPLAY_NAME;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ").trim() || user.username || DEV_DISPLAY_NAME;
}

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16);
}

/** Telegram's light/dark flag ignores a custom palette. The background decides. */
export function schemeFromColor(color: string | undefined): "light" | "dark" | null {
  const match = /^#([\da-f]{6})$/i.exec(color?.trim() ?? "");
  if (!match) return null;
  const hex = match[1];
  const luminance =
    (0.2126 * channel(hex, 0) +
      0.7152 * channel(hex, 2) +
      0.0722 * channel(hex, 4)) /
    255;
  return luminance > 0.55 ? "light" : "dark";
}

/** Light panel colors in a dark Telegram theme make white labels disappear. */
export function panelColor(
  theme: ThemeParams,
  colorScheme: "light" | "dark",
): string | undefined {
  const secondary = theme.secondary_bg_color;
  if (colorScheme !== "dark") return secondary;
  if (!secondary) return theme.bg_color;
  const match = /^#([\da-f]{6})$/i.exec(secondary.trim());
  if (!match) return secondary;
  const hex = match[1];
  const luminance =
    (0.2126 * channel(hex, 0) +
      0.7152 * channel(hex, 2) +
      0.0722 * channel(hex, 4)) /
    255;
  return luminance > 0.65 ? theme.bg_color : secondary;
}

/** Map Telegram theme params onto Between CSS variables when present. */
export function applyTelegramTheme(theme: ThemeParams, colorScheme: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.telegramTheme = colorScheme;
  root.style.setProperty(
    "color-scheme",
    schemeFromColor(theme.bg_color) ?? colorScheme,
  );

  const set = (name: string, value: string | undefined) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };

  set("--tg-bg-color", theme.bg_color);
  set("--tg-text-color", theme.text_color);
  set("--tg-hint-color", theme.hint_color);
  set("--tg-button-color", theme.button_color);
  set("--tg-button-text-color", theme.button_text_color);
  set("--tg-secondary-bg-color", theme.secondary_bg_color);
  set("--tg-destructive-color", theme.destructive_text_color);
  set("--tg-section-bg-color", theme.section_bg_color);
  set("--tg-link-color", theme.link_color);
  set("--tg-header-bg-color", theme.header_bg_color);
  set("--tg-bottom-bar-bg-color", theme.bottom_bar_bg_color);
  set("--tg-accent-text-color", theme.accent_text_color);
  set("--tg-section-header-text-color", theme.section_header_text_color);
  set("--tg-subtitle-text-color", theme.subtitle_text_color);
  set("--section-header", theme.section_header_text_color);
  set("--subtitle", theme.subtitle_text_color);
  set("--accent-text", theme.accent_text_color);
  set("--link", theme.link_color);

  // Soft override of app tokens so the Mini App matches Telegram chrome
  set("--background", theme.bg_color);
  set("--foreground", theme.text_color);
  set("--muted-foreground", theme.hint_color);
  set("--primary", theme.button_color);
  set("--primary-foreground", theme.button_text_color);
  set("--card", theme.section_bg_color || theme.secondary_bg_color);
  set("--card-foreground", theme.text_color);
  set("--popover-foreground", theme.text_color);
  // Telegram replaces the panel background but not these ink colors.
  // A light --muted left over from the default theme paints "Свернуть" white-on-white.
  const panel = panelColor(theme, colorScheme);
  set("--muted", panel);
  set("--secondary", panel);
  set("--secondary-foreground", theme.text_color);
  set("--accent", panel);
  set("--accent-foreground", theme.text_color);
  set("--border", theme.section_separator_color || theme.hint_color);
  set("--input", panel);
  set("--destructive", theme.destructive_text_color);
  set("--ring", theme.button_color || theme.link_color);
}

export type TelegramChromeFallback = "bg_color" | "secondary_bg_color" | "bottom_bar_bg_color";

/** Hex from themeParams, otherwise a keyword Telegram accepts for chrome colors. */
export function telegramChromeColor<T extends TelegramChromeFallback>(
  color: string | undefined,
  fallback: T,
): T | `#${string}` {
  if (color && /^#[\da-fA-F]{6}$/.test(color)) return color as `#${string}`;
  return fallback;
}

export function applyTelegramChrome(webApp: WebApp) {
  const theme = webApp.themeParams;
  const header = telegramChromeColor(theme?.header_bg_color, "bg_color");
  const background = telegramChromeColor(theme?.bg_color, "bg_color");
  const bottom = telegramChromeColor(theme?.bottom_bar_bg_color, "bg_color");
  try {
    webApp.setHeaderColor(header);
  } catch {
    // Bot API older than 6.1
  }
  try {
    webApp.setBackgroundColor(background);
  } catch {
    // Bot API older than 6.1
  }
  try {
    webApp.setBottomBarColor(bottom);
  } catch {
    // Bot API older than 7.10
  }
}

export type DevicePerformance = "LOW" | "AVERAGE" | "HIGH";

const ANDROID_PERFORMANCE =
  /Telegram-Android\/[\d.]+ \([^;]*; Android [^;]*; SDK \d+; (LOW|AVERAGE|HIGH)\)/;

/** Android Mini App appends LOW, AVERAGE, or HIGH to the user agent. */
export function performanceClassFromUserAgent(ua: string): DevicePerformance | null {
  const match = ANDROID_PERFORMANCE.exec(ua);
  if (!match) return null;
  return match[1] as DevicePerformance;
}

export function applyDevicePerformance(ua: string) {
  const root = document.documentElement;
  const level = performanceClassFromUserAgent(ua);
  if (!level) {
    delete root.dataset.performance;
    return null;
  }
  root.dataset.performance = level.toLowerCase();
  return level;
}

/** Selection click, the same feedback Telegram uses for lists and segmented controls. */
export function telegramSelection() {
  try {
    telegramWebApp()?.HapticFeedback.selectionChanged();
  } catch {
    // Haptics are missing outside Telegram and on older clients.
  }
}

export function applyViewportHeight(height: number) {
  if (!height || Number.isNaN(height)) return;
  document.documentElement.style.setProperty(
    "--tg-viewport-stable-height",
    `${height}px`,
  );
}

function telegramWebApp(): WebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: WebApp } }).Telegram?.WebApp;
}

/** Stop Telegram from treating a downward drag as “close the Mini App”. */
export function setTelegramVerticalSwipes(enabled: boolean) {
  const webApp = telegramWebApp();
  if (!webApp) return;
  try {
    if (enabled) webApp.enableVerticalSwipes();
    else webApp.disableVerticalSwipes();
  } catch {
    // Bot API older than 7.7 has no vertical-swipe switch.
  }
}

type EdgeInsets = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
} | null | undefined;

const EDGES = ["top", "right", "bottom", "left"] as const;

function writeInsets(prefix: "safe-area" | "content-safe-area", insets: EdgeInsets) {
  const root = document.documentElement;
  for (const edge of EDGES) {
    const name = `--tg-${prefix}-${edge}`;
    const value = Math.max(insets?.[edge] ?? 0, 0);
    if (value) root.style.setProperty(name, `${value}px`);
    else root.style.removeProperty(name);
  }
}

export function applyTelegramSafeArea(safe?: EdgeInsets, content?: EdgeInsets) {
  writeInsets("safe-area", safe);
  writeInsets("content-safe-area", content);
}

export function clearTelegramThemeOverrides() {
  const root = document.documentElement;
  delete root.dataset.telegramTheme;
  delete root.dataset.performance;
  root.style.removeProperty("color-scheme");
  const keys = [
    "--tg-bg-color",
    "--tg-text-color",
    "--tg-hint-color",
    "--tg-button-color",
    "--tg-button-text-color",
    "--tg-secondary-bg-color",
    "--tg-destructive-color",
    "--tg-section-bg-color",
    "--tg-link-color",
    "--tg-header-bg-color",
    "--tg-bottom-bar-bg-color",
    "--tg-accent-text-color",
    "--tg-section-header-text-color",
    "--tg-subtitle-text-color",
    "--section-header",
    "--subtitle",
    "--accent-text",
    "--link",
    "--tg-viewport-stable-height",
    "--tg-safe-area-top",
    "--tg-safe-area-right",
    "--tg-safe-area-bottom",
    "--tg-safe-area-left",
    "--tg-content-safe-area-top",
    "--tg-content-safe-area-right",
    "--tg-content-safe-area-bottom",
    "--tg-content-safe-area-left",
    "--background",
    "--foreground",
    "--muted-foreground",
    "--primary",
    "--primary-foreground",
    "--card",
    "--card-foreground",
    "--popover-foreground",
    "--muted",
    "--secondary",
    "--secondary-foreground",
    "--accent",
    "--accent-foreground",
    "--border",
    "--input",
    "--destructive",
    "--ring",
  ];
  for (const key of keys) root.style.removeProperty(key);
}
