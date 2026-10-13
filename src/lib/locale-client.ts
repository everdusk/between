import type { LocaleId } from "./i18n";

export function syncLocale(
  initData: string,
  body: { locale?: LocaleId; device?: LocaleId },
): void {
  if (!initData) return;
  void fetch("/api/locale", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": initData,
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}
