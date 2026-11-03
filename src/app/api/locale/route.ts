import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { isLocale } from "@/lib/i18n";
import { redisConfigured, saveDeviceLocale, saveUserLocale } from "@/lib/redis";
import { sessionSecret } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!redisConfigured() || !sessionSecret()) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const actor = await actorFromRequest(req);
  if (!actor) {
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
  if (locale) await saveUserLocale(actor.id, locale);
  if (device) await saveDeviceLocale(actor.id, device);
  return NextResponse.json({ ok: true });
}
