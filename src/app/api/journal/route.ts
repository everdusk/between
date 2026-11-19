import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { trackServerEvent } from "@/lib/analytics";
import { applyJournalWrite, entriesHeld } from "@/lib/journal-api";
import { normalizeStore } from "@/lib/migrate";
import { sessionPlanStamp } from "@/lib/session-plan";
import {
  getUserTimezone,
  journalCacheId,
  getRedis,
  loadUserStore,
  loadWeekAccess,
  redisConfigured,
  rememberUser,
  setUserTimezone,
} from "@/lib/redis";
import {
  accessForUser,
  entriesOpen,
  messengerAccessIdentity,
} from "@/lib/week-access";
import { emptyStore } from "@/lib/types";
import { sessionSecret } from "@/lib/web-account";
import { isValidTimeZone } from "@/lib/zoned";

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401 },
  );
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

  const cacheId = await journalCacheId(actor.id);
  const store = await loadUserStore(actor.id);
  const timeZone = await getUserTimezone(actor.id);
  await rememberUser(actor.id);

  return NextResponse.json({
    ok: true,
    cacheId,
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
    return NextResponse.json(
      { ok: false, error: "invalid_store" },
      { status: 400 },
    );
  }

  const dropIds = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .slice(0, 40)
      : [];
  const redis = getRedis()!;
  const revision = () =>
    redis.eval<string[], string>(
      "return redis.sha1hex(redis.call('GET',KEYS[1]) or '')",
      [`between:user:${actor.id}:store`],
      [],
    );
  const cacheId = req.headers.get("x-journal-cache");
  if (!cacheId)
    return NextResponse.json(
      { ok: false, error: "refresh_required" },
      { status: 409 },
    );
  const access = accessForUser(
    await loadWeekAccess(actor.id),
    messengerAccessIdentity({
      telegramUserId: actor.telegramUserId,
      username: actor.telegramUsername,
      maxUserId:
        actor.messenger === "max" && typeof actor.analyticsId === "number"
          ? actor.analyticsId
          : null,
    }),
    process.env.WEEK_EXEMPT_USER_IDS,
    new Date(),
  );
  for (let attempt = 0; attempt < 4; attempt++) {
    const stamp = await revision();
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
    if (!entriesOpen(access.view.status) && !entriesHeld(previous, next)) {
      return NextResponse.json(
        { ok: false, error: "entries_closed" },
        { status: 403 },
      );
    }
    const result = await redis.eval<string[], number>(
      `
    if redis.call('GET',KEYS[2]) ~= ARGV[1] then return -1 end
    if redis.sha1hex(redis.call('GET',KEYS[1]) or '') ~= ARGV[2] then return 0 end
    redis.call('SET',KEYS[1],ARGV[3])
    redis.call('SADD',KEYS[3],ARGV[4])
    return 1`,
      [
        `between:user:${actor.id}:store`,
        `between:user:${actor.id}:cache-id`,
        "between:users",
      ],
      [cacheId, stamp, JSON.stringify(next), actor.id],
    );
    if (result < 0)
      return NextResponse.json(
        { ok: false, error: "refresh_required" },
        { status: 409 },
      );
    if (!result) continue;
    const savedPlan = sessionPlanStamp(next.sessionPlan);
    if (savedPlan && savedPlan !== sessionPlanStamp(previous?.sessionPlan)) {
      await trackServerEvent({
        userId: actor.analyticsId,
        event: "plan",
        messenger: actor.messenger,
        username: actor.telegramUsername,
      });
    }

    if (
      typeof payload.timeZone === "string" &&
      isValidTimeZone(payload.timeZone)
    ) {
      await setUserTimezone(actor.id, payload.timeZone);
    }

    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "retry" }, { status: 409 });
}
