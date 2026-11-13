import { NextResponse } from "next/server";
import { acceptClientEvent, analyticsRedis, loadAnalyticsReport, recordAnalytics, trackSubscribeStep, type AnalyticsRedis } from "@/lib/analytics";
import { PRODUCT_PLANS, SUBSCRIBE_FAILS, SUBSCRIBE_STEPS, analyticsQuiet, type AnalyticsMessenger, type ClientAnalyticsEvent, type ProductPlan, type SubscribeFail, type SubscribeStep } from "@/lib/analytics-model";
import { validateMaxInitData } from "@/lib/max-auth";
import { captureServerProduct } from "@/lib/product-analytics-server";
import { redisConfigured } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import { DEFAULT_TIME_ZONE } from "@/lib/types";
import { sessionSecret, sessionTokenFromRequest } from "@/lib/web-account";
import { accountFromSession } from "@/lib/web-account-store";
import { todayInTimeZone } from "@/lib/zoned";

function quiet(input: { username?: string | null; userId?: number | string | null; messenger?: "telegram" | "max" | "web" }): boolean {
  return analyticsQuiet({ ...input, owners: process.env.ANALYTICS_OWNERS });
}

function readPlan(value: unknown): ProductPlan | undefined {
  return (PRODUCT_PLANS as readonly string[]).includes(String(value)) ? (value as ProductPlan) : undefined;
}

function readSubscribeStep(value: unknown): SubscribeStep | null {
  return (SUBSCRIBE_STEPS as readonly string[]).includes(String(value)) ? (value as SubscribeStep) : null;
}

function readSubscribeFail(step: SubscribeStep, value: unknown): SubscribeFail | undefined {
  if (step !== "pay_fail") return undefined;
  return (SUBSCRIBE_FAILS as readonly string[]).includes(String(value)) ? (value as SubscribeFail) : undefined;
}

/** Redis keeps one step per person per day. PostHog hears the same step under the bot's person id. */
async function countClientStep(
  redis: AnalyticsRedis,
  input: {
    userId: number | string;
    messenger: AnalyticsMessenger;
    event: ClientAnalyticsEvent;
    day: string;
    cohort: string;
    offset: number;
    pepper: string;
    plan?: ProductPlan;
  },
): Promise<void> {
  const result = await recordAnalytics(redis, {
    userId: input.userId,
    event: input.event,
    messenger: input.messenger,
    day: input.day,
    cohort: input.cohort,
    offset: input.offset,
    pepper: input.pepper,
  });
  if (result !== "counted") return;
  await captureServerProduct({
    userId: input.userId,
    event: input.event,
    messenger: input.messenger,
    plan: input.plan,
  });
}

/** Checkout detail for the person who already owns the funnel events. No `/stats` counter. */
async function noteSubscribe(
  req: Request,
  input: { step: SubscribeStep; plan?: ProductPlan; fail?: SubscribeFail },
): Promise<{ ok: true; quiet?: boolean } | { ok: false; error: string; status: number }> {
  const pepper = process.env.BOT_TOKEN?.trim() || process.env.MAX_BOT_TOKEN?.trim() || process.env.APP_SECRET?.trim();
  if (!pepper) return { ok: false, error: "server_not_configured", status: 503 };

  const maxInit = req.headers.get("x-max-init-data");
  if (maxInit) {
    const validated = validateMaxInitData(maxInit, process.env.MAX_BOT_TOKEN);
    if (!validated) return { ok: false, error: "unauthorized", status: 401 };
    if (quiet({ username: validated.user.username, userId: validated.user.id, messenger: "max" })) {
      return { ok: true, quiet: true };
    }
    await trackSubscribeStep({
      userId: validated.user.id,
      messenger: "max",
      username: validated.user.username,
      ...input,
    });
    return { ok: true };
  }

  const telegramInit = req.headers.get("x-telegram-init-data");
  if (telegramInit) {
    const validated = validateInitData(telegramInit);
    if (!validated) return { ok: false, error: "unauthorized", status: 401 };
    if (quiet({ username: validated.user.username, userId: validated.user.id, messenger: "telegram" })) {
      return { ok: true, quiet: true };
    }
    await trackSubscribeStep({
      userId: validated.user.id,
      messenger: "telegram",
      username: validated.user.username,
      ...input,
    });
    return { ok: true };
  }

  const device = req.headers.get("x-between-device") ?? "";
  if (!/^[a-z0-9]{32}$/.test(device)) return { ok: false, error: "unauthorized", status: 401 };
  const secret = sessionSecret();
  const token = secret ? sessionTokenFromRequest(req) : null;
  const account = secret && token ? await accountFromSession(token, secret) : null;
  if (
    account &&
    (quiet({ username: account.telegramUsername, messenger: "web" }) ||
      quiet({ userId: account.maxUserId, messenger: "max" }))
  ) {
    return { ok: true, quiet: true };
  }
  await trackSubscribeStep({ userId: `web:${device}`, messenger: "web", ...input });
  return { ok: true };
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
  const payload = body as {
    event?: unknown;
    cohort?: unknown;
    day?: unknown;
    messenger?: unknown;
    plan?: unknown;
    step?: unknown;
    fail?: unknown;
  };
  const plan = readPlan(payload.plan);
  if (payload.event === "subscribe") {
    const step = readSubscribeStep(payload.step);
    if (!step) return NextResponse.json({ ok: false, error: "bad_step" }, { status: 400 });
    const fail = readSubscribeFail(step, payload.fail);
    const noted = await noteSubscribe(req, { step, plan, fail });
    if (!noted.ok) return NextResponse.json({ ok: false, error: noted.error }, { status: noted.status });
    return NextResponse.json({ ok: true, ...(noted.quiet ? { quiet: true } : {}) });
  }
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
    await countClientStep(redis, {
      userId: validated.user.id,
      event: accepted.event,
      messenger: "max",
      day: accepted.day,
      cohort: accepted.cohort,
      offset: accepted.offset,
      pepper,
      plan,
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
    await countClientStep(redis, {
      userId: `web:${device}`,
      event: accepted.event,
      messenger: "web",
      day: accepted.day,
      cohort: accepted.cohort,
      offset: accepted.offset,
      pepper,
      plan,
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
  await countClientStep(redis, {
    userId: validated.user.id,
    event: accepted.event,
    messenger: "telegram",
    day: accepted.day,
    cohort: accepted.cohort,
    offset: accepted.offset,
    pepper,
    plan,
  });
  return NextResponse.json({ ok: true });
}
