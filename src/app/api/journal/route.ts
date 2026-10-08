import { NextResponse } from "next/server";
import {
  getUserTimezone,
  loadUserStore,
  redisConfigured,
  saveUserStore,
  setUserTimezone,
} from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { emptyStore, type TherapyStore } from "@/lib/types";

function isStore(value: unknown): value is TherapyStore {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    Array.isArray(v.entries) &&
    Array.isArray(v.sessions) &&
    Array.isArray(v.weekPreps)
  );
}

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
  if (!isStore(payload.store)) {
    return NextResponse.json({ ok: false, error: "invalid_store" }, { status: 400 });
  }

  await saveUserStore(validated.user.id, payload.store);

  if (typeof payload.timeZone === "string" && payload.timeZone.length > 0) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: payload.timeZone });
      await setUserTimezone(validated.user.id, payload.timeZone);
    } catch {
      // ignore invalid tz
    }
  }

  return NextResponse.json({ ok: true });
}
