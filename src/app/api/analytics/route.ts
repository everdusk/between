import { NextResponse } from "next/server";
import { acceptClientEvent, analyticsRedis, loadAnalyticsReport, recordAnalytics } from "@/lib/analytics";
import { analyticsQuiet } from "@/lib/analytics-model";
import { validateMaxInitData } from "@/lib/max-auth";
import { redisConfigured } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { DEFAULT_TIME_ZONE } from "@/lib/types";
import { sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";
import { accountFromSession } from "@/lib/web-account-store";
import { todayInTimeZone } from "@/lib/zoned";

function quiet(input: { username?: string | null; userId?: number | string | null; messenger?: "telegram" | "max" | "web" }): boolean {
  return analyticsQuiet({ ...input, owners: process.env.ANALYTICS_OWNERS });
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const redis = analyticsRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const report = await loadAnalyticsReport(redis);
  return NextResponse.json({ ok: true, report });
}

export async function POST(req: Request) {
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim() || process.env.APP_SECRET?.trim();
  if (!redisConfigured() || !pepper) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { event?: unknown; cohort?: unknown; day?: unknown; messenger?: unknown };
  const accepted = acceptClientEvent(payload, todayInTimeZone(DEFAULT_TIME_ZONE));
  if (!accepted.ok) {
    return NextResponse.json({ ok: false, error: accepted.error }, { status: 400 });
  }

  const redis = analyticsRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }

  if (payload.messenger === "max") {
    const initData = req.headers.get("x-max-init-data");
    const validated = initData ? validateMaxInitData(initData, process.env.MAX_BOT_TOKEN) : null;
    if (!validated) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (quiet({ username: validated.user.username, userId: validated.user.id, messenger: "max" })) {
      return NextResponse.json({ ok: true, quiet: true });
    }
    await recordAnalytics(redis, {
      userId: validated.user.id,
      event: accepted.event,
      messenger: "max",
      day: accepted.day,
      cohort: accepted.cohort,
      offset: accepted.offset,
      pepper,
    });
    return NextResponse.json({ ok: true });
  }

  if (payload.messenger === "web") {
    const device = req.headers.get("x-between-device") ?? "";
    if (!/^[a-z0-9]{32}$/.test(device)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const secret = sessionSecret();
    const token = secret ? sessionTokenFromRequest(req) : null;
    const account = secret && token ? await accountFromSession(token, secret) : null;
    if (
      account &&
      (quiet({ username: account.telegramUsername, messenger: "web" }) ||
        quiet({ userId: account.maxUserId, messenger: "max" }))
    ) {
      return NextResponse.json({ ok: true, quiet: true });
    }
    await recordAnalytics(redis, {
      userId: `web:${device}`,
      event: accepted.event,
      messenger: "web",
      day: accepted.day,
      cohort: accepted.cohort,
      offset: accepted.offset,
      pepper,
    });
    return NextResponse.json({ ok: true });
  }

  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const validated = validateInitData(initData);
  if (!validated) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (quiet({ username: validated.user.username, userId: validated.user.id, messenger: "telegram" })) {
    return NextResponse.json({ ok: true, quiet: true });
  }
  await recordAnalytics(redis, {
    userId: validated.user.id,
    event: accepted.event,
    messenger: "telegram",
    day: accepted.day,
    cohort: accepted.cohort,
    offset: accepted.offset,
    pepper,
  });
  return NextResponse.json({ ok: true });
}
