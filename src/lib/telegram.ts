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

/** Map Telegram theme params onto Between CSS variables when present. */
export function applyTelegramTheme(theme: ThemeParams, colorScheme: "light" | "dark") {
  const root = document.documentElement;
  root.dataset.telegramTheme = colorScheme;

  const set = (name: string, value: string | undefined) => {
    if (value) root.style.setProperty(name, value);
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
  // Leaving the light-theme ink makes badges and secondary buttons look empty.
  set("--secondary", theme.secondary_bg_color);
  set("--secondary-foreground", theme.text_color);
  set("--accent", theme.secondary_bg_color);
  set("--accent-foreground", theme.text_color);
  set("--border", theme.section_separator_color || theme.hint_color);
  set("--input", theme.secondary_bg_color);
  set("--destructive", theme.destructive_text_color);
  set("--ring", theme.button_color || theme.link_color);
}

export function applyViewportHeight(height: number) {
  if (!height || Number.isNaN(height)) return;
  document.documentElement.style.setProperty(
    "--tg-viewport-stable-height",
    `${height}px`,
  );
}

export function clearTelegramThemeOverrides() {
  const root = document.documentElement;
  delete root.dataset.telegramTheme;
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
    "--tg-viewport-stable-height",
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
