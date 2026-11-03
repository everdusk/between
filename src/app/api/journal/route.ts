import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { normalizeStore } from "@/lib/migrate";
import {
  getUserTimezone,
  loadUserStore,
  redisConfigured,
  rememberUser,
  saveUserStore,
  setUserTimezone,
} from "@/lib/redis";
import { emptyStore } from "@/lib/types";
import { sessionSecret } from "@/lib/web-account";
import { isValidTimeZone } from "@/lib/zoned";

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
  if (!redisConfigured() || !sessionSecret()) return misconfigured();
  const actor = await actorFromRequest(req);
  if (!actor) return unauthorized();

  const store = await loadUserStore(actor.id);
  const timeZone = await getUserTimezone(actor.id);
  await rememberUser(actor.id);

  return NextResponse.json({
    ok: true,
    store: store ?? emptyStore(),
    timeZone,
  });
}

export async function PUT(req: Request) {
  if (!redisConfigured() || !sessionSecret()) return misconfigured();
  const actor = await actorFromRequest(req);
  if (!actor) return unauthorized();

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

  await saveUserStore(actor.id, store);

  if (typeof payload.timeZone === "string" && isValidTimeZone(payload.timeZone)) {
    await setUserTimezone(actor.id, payload.timeZone);
  }

  return NextResponse.json({ ok: true });
}
