import { NextResponse } from "next/server";
import { actorFromRequest, type Actor } from "@/lib/account-actor";
import { loadWeekAccess, redisConfigured, saveWeekAccess } from "@/lib/redis";
import { claimPendingSbp } from "@/lib/sbp-live";
import { loadAccount } from "@/lib/web-account-store";
import {
  accessForUser,
  canPreviewPaywall,
  adoptClientTrial,
  markWeekIntroSeen,
  normalizeWeekAccess,
  openWeekAccess,
  rubPriceFromEnv,
  starPriceFromEnv,
  type WeekAccessIdentity,
  type WeekAccessRecord,
} from "@/lib/week-access";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function misconfigured() {
  return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
}

function identityOf(actor: Actor): WeekAccessIdentity {
  return {
    id: actor.telegramUserId ?? 0,
    username: actor.telegramUsername ?? undefined,
  };
}

async function granted(record: WeekAccessRecord, actor: Actor) {
  const resolved = accessForUser(
    record,
    identityOf(actor),
    process.env.WEEK_EXEMPT_USER_IDS,
    new Date(),
    starPriceFromEnv(process.env.WEEK_STAR_PRICE),
    rubPriceFromEnv(process.env.WEEK_RUB_PRICE),
  );
  if (resolved.changed) await saveWeekAccess(actor.id, resolved.record);
  if (canPreviewPaywall(identityOf(actor), process.env.WEEK_EXEMPT_USER_IDS)) {
    resolved.view = { ...resolved.view, previewPaywall: true };
  }
  return resolved;
}

export async function GET(req: Request) {
  if (!redisConfigured()) return misconfigured();
  const actor = await actorFromRequest(req);
  if (!actor) return unauthorized();
  if (actor.id.startsWith("web:")) {
    const account = await loadAccount(actor.id.slice(4));
    if (account) await claimPendingSbp(account.email, actor.id);
  }
  const record = await loadWeekAccess(actor.id);
  const resolved = await granted(record, actor);
  return NextResponse.json({ ok: true, access: resolved.view });
}

export async function POST(req: Request) {
  if (!redisConfigured()) return misconfigured();
  const actor = await actorFromRequest(req);
  if (!actor) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const action = (body as { action?: unknown }).action;
  if (action !== "open" && action !== "seen") {
    return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
  }

  const now = new Date();
  let current = await loadWeekAccess(actor.id);
  if (action === "open") {
    current = adoptClientTrial(current, normalizeWeekAccess((body as { local?: unknown }).local), now);
    current = openWeekAccess(current, now);
  } else {
    current = markWeekIntroSeen(current);
  }
  const resolved = await granted(current, actor);
  if (!resolved.changed) await saveWeekAccess(actor.id, resolved.record);
  return NextResponse.json({ ok: true, access: resolved.view });
}
