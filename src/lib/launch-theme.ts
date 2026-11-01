/**
 * Theme colors from the Mini App launch hash. Runs before first paint,
 * while the journal is still hidden behind the splash.
 */
export function applyLaunchTheme(
  hash: string,
  root: {
    dataset: { telegramTheme?: string };
    style: { setProperty: (name: string, value: string) => void };
  },
): boolean {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const raw = params.get("tgWebAppThemeParams");
  if (!raw) return false;
  let theme: Record<string, unknown>;
  try {
    theme = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }
  const hex = (value: unknown) =>
    typeof value === "string" && /^#[\da-fA-F]{6}$/.test(value.trim()) ? value.trim() : "";
  const bg = hex(theme.bg_color);
  if (!bg) return false;
  const channel = (start: number) => Number.parseInt(bg.slice(start, start + 2), 16);
  const luminance = (0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)) / 255;
  root.dataset.telegramTheme = luminance > 0.55 ? "light" : "dark";
  const set = (name: string, value: unknown) => {
    const color = hex(value);
    if (color) root.style.setProperty(name, color);
  };
  set("--tg-bg-color", theme.bg_color);
  set("--background", theme.bg_color);
  set("--tg-text-color", theme.text_color);
  set("--foreground", theme.text_color);
  set("--tg-hint-color", theme.hint_color);
  set("--muted-foreground", theme.hint_color);
  set("--tg-button-color", theme.button_color);
  set("--primary", theme.button_color);
  set("--tg-button-text-color", theme.button_text_color);
  set("--primary-foreground", theme.button_text_color);
  set("--tg-secondary-bg-color", theme.secondary_bg_color);
  set("--card", hex(theme.section_bg_color) ? theme.section_bg_color : theme.secondary_bg_color);
  set("--muted", theme.secondary_bg_color);
  set("--secondary", theme.secondary_bg_color);
  return true;
}

/** Hides the journal until the frame leaves, even if position:fixed is not covering yet. */
export const SPLASH_COVER_CSS = `
.app-root { display: contents; }
html[data-splash], html[data-splash] body { background: #0c1210 !important; background-image: none !important; }
html[data-splash] .app-root { display: none !important; }
html[data-splash] .splash-screen {
  display: flex !important;
  position: fixed;
  top: 0; right: 0; bottom: 0; left: 0;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  z-index: 80;
  background: #0c1210;
}
`.trim();

export const LAUNCH_THEME_SCRIPT = `try{(${applyLaunchTheme.toString()})(location.hash,document.documentElement)}catch(e){}`;
