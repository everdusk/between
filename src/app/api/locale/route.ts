import { NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { redisConfigured, saveDeviceLocale, saveUserLocale } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";

export async function POST(req: Request) {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateInitData(initData);
  if (!validated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { locale?: unknown; device?: unknown };
  const locale = isLocale(payload.locale) ? payload.locale : null;
  const device = isLocale(payload.device) ? payload.device : null;
  if (!locale && !device) {
    return NextResponse.json({ ok: false, error: "bad_locale" }, { status: 400 });
  }
  if (locale) await saveUserLocale(validated.user.id, locale);
  if (device) await saveDeviceLocale(validated.user.id, device);
  return NextResponse.json({ ok: true });
}
