import { NextResponse } from "next/server";
import { acceptClientEvent, analyticsRedis, loadAnalyticsReport, recordAnalytics } from "@/lib/analytics";
import { redisConfigured } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { DEFAULT_TIME_ZONE } from "@/lib/types";
import { todayInTimeZone } from "@/lib/zoned";

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
  const payload = body as { event?: unknown; cohort?: unknown; day?: unknown };
  const accepted = acceptClientEvent(payload, todayInTimeZone(DEFAULT_TIME_ZONE));
  if (!accepted.ok) {
    return NextResponse.json({ ok: false, error: accepted.error }, { status: 400 });
  }

  const redis = analyticsRedis();
  const pepper = process.env.BOT_TOKEN?.trim();
  if (!redis || !pepper) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
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
