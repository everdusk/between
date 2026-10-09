import { NextResponse } from "next/server";
import { normalizeStore } from "@/lib/migrate";
import {
  getUserTimezone,
  loadUserStore,
  redisConfigured,
  rememberUser,
  saveUserStore,
  setUserTimezone,
} from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { emptyStore } from "@/lib/types";
import { isValidTimeZone } from "@/lib/zoned";

function initDataFrom(req: Request): string | null {
  return req.headers.get("x-telegram-init-data");
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function misconfigured() {
  return NextResponse.json(
    { ok: false, error: "server_not_configured" },
    { status: 503 },
  );
}

export async function GET(req: Request) {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) {
    return misconfigured();
  }
  const initData = initDataFrom(req);
  if (!initData) return unauthorized();
  const validated = validateInitData(initData);
  if (!validated) return unauthorized();

  const store = await loadUserStore(validated.user.id);
  const timeZone = await getUserTimezone(validated.user.id);
  await rememberUser(validated.user.id);

  return NextResponse.json({
    ok: true,
    store: store ?? emptyStore(),
    timeZone,
  });
}

export async function PUT(req: Request) {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) {
    return misconfigured();
  }
  const initData = initDataFrom(req);
  if (!initData) return unauthorized();
  const validated = validateInitData(initData);
  if (!validated) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const payload = body as { store?: unknown; timeZone?: unknown };
  const store = normalizeStore(payload.store);
  if (!store) {
    return NextResponse.json({ ok: false, error: "invalid_store" }, { status: 400 });
  }

  await saveUserStore(validated.user.id, store);

  if (typeof payload.timeZone === "string" && isValidTimeZone(payload.timeZone)) {
    await setUserTimezone(validated.user.id, payload.timeZone);
  }

  return NextResponse.json({ ok: true });
}
