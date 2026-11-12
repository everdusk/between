import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { trackServerEvent } from "@/lib/analytics";
import { applyJournalWrite } from "@/lib/journal-api";
import { normalizeStore } from "@/lib/migrate";
import { sessionPlanStamp } from "@/lib/session-plan";
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

  const payload = body as {
    store?: unknown;
    timeZone?: unknown;
    replace?: unknown;
    dropEntryIds?: unknown;
    dropSessionIds?: unknown;
  };
  const store = normalizeStore(payload.store);
  if (!store) {
    return NextResponse.json({ ok: false, error: "invalid_store" }, { status: 400 });
  }

  const dropIds = (value: unknown) =>
    Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 40) : [];
  const previous = await loadUserStore(actor.id);
  const next =
    payload.replace === true
      ? store
      : applyJournalWrite(
          previous,
          store,
          dropIds(payload.dropEntryIds),
          dropIds(payload.dropSessionIds),
        );
  await saveUserStore(actor.id, next);
  const savedPlan = sessionPlanStamp(next.sessionPlan);
  if (savedPlan && savedPlan !== sessionPlanStamp(previous?.sessionPlan)) {
    await trackServerEvent({
      userId: actor.analyticsId,
      event: "plan",
      messenger: actor.messenger,
      username: actor.telegramUsername,
    });
  }

  if (typeof payload.timeZone === "string" && isValidTimeZone(payload.timeZone)) {
    await setUserTimezone(actor.id, payload.timeZone);
  }

  return NextResponse.json({ ok: true });
}
