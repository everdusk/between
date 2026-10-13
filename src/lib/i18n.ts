/** Languages of Telegram's largest audiences, in audience order after Russian. */
export const LOCALES = [
  { id: "ru", label: "Русский", intl: "ru", dir: "ltr" },
  { id: "en", label: "English", intl: "en", dir: "ltr" },
  { id: "hi", label: "हिन्दी", intl: "hi", dir: "ltr" },
  { id: "id", label: "Bahasa Indonesia", intl: "id", dir: "ltr" },
  { id: "pt", label: "Português", intl: "pt-BR", dir: "ltr" },
  { id: "ar", label: "العربية", intl: "ar", dir: "rtl" },
  { id: "es", label: "Español", intl: "es", dir: "ltr" },
  { id: "vi", label: "Tiếng Việt", intl: "vi", dir: "ltr" },
  { id: "uk", label: "Українська", intl: "uk", dir: "ltr" },
  { id: "tr", label: "Türkçe", intl: "tr", dir: "ltr" },
  { id: "fa", label: "فارسی", intl: "fa", dir: "rtl" },
  { id: "uz", label: "Oʻzbekcha", intl: "uz", dir: "ltr" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];

const LOCALE_IDS = new Set<string>(LOCALES.map((item) => item.id));

export function isLocale(value: unknown): value is LocaleId {
  return typeof value === "string" && LOCALE_IDS.has(value);
}

export function localeMeta(id: LocaleId) {
  return LOCALES.find((item) => item.id === id) ?? LOCALES[0];
}

/** Maps a Telegram or browser language code onto a supported audience language. */
export function localeFromTelegram(code: string | null | undefined): LocaleId | null {
  if (!code) return null;
  const base = code.toLowerCase().split("-")[0];
  if (base === "in") return "id";
  return isLocale(base) ? base : null;
}

export function localeFromLanguages(
  codes: readonly (string | null | undefined)[],
): LocaleId | null {
  for (const code of codes) {
    const locale = localeFromTelegram(code);
    if (locale) return locale;
  }
  return null;
}

/** Preferred language of this browser or WebView. */
export function deviceLocaleFromNavigator(): LocaleId {
  if (typeof navigator === "undefined") return "ru";
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  return localeFromLanguages(list) ?? "ru";
}

/** Bot replies and mood buttons follow an explicit choice, then the device. */
export function resolveBotLocale(
  selected: LocaleId | null,
  device: LocaleId | null,
  telegramCode?: string | null,
): LocaleId {
  return selected ?? device ?? localeFromTelegram(telegramCode) ?? "ru";
}

/** The greeting ignores the in-app choice and follows the device. */
export function resolveGreetingLocale(
  navigatorCode: string | null | undefined,
  device: LocaleId | null,
  telegramCode?: string | null,
): LocaleId {
  return localeFromTelegram(navigatorCode) ?? device ?? localeFromTelegram(telegramCode) ?? "ru";
}

const MODEL_LANGUAGE: Record<LocaleId, string> = {
  ru: "Russian",
  en: "English",
  hi: "Hindi",
  id: "Indonesian",
  pt: "Brazilian Portuguese",
  ar: "Arabic",
  es: "Spanish",
  vi: "Vietnamese",
  uk: "Ukrainian",
  tr: "Turkish",
  fa: "Persian",
  uz: "Uzbek",
};

export function modelLanguageName(id: LocaleId): string {
  return MODEL_LANGUAGE[id];
}

export function fill(
  template: string,
  vars: Record<string, string | number | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? "" : String(vars[name]),
  );
}
