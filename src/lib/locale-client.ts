import type { LocaleId } from "./i18n";

export async function syncLocale(
  initData: string,
  maxInitData: string,
  body: { locale?: LocaleId; device?: LocaleId },
): Promise<{locale: LocaleId | null}> {
  const res = await fetch("/api/locale", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(initData && { "X-Telegram-Init-Data": initData }),
      ...(maxInitData && { "X-Max-Init-Data": maxInitData }),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Language sync failed");
  return res.json();
}
