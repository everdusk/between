import { NextResponse } from "next/server";
import { loadWeekAccess, redisConfigured, saveWeekAccess } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import {
  describeWeekAccess,
  markWeekIntroSeen,
  openWeekAccess,
  starPriceFromEnv,
} from "@/lib/week-access";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function misconfigured() {
  return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
}

function authed(req: Request) {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) return { error: misconfigured() };
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) return { error: unauthorized() };
  const validated = validateInitData(initData);
  if (!validated) return { error: unauthorized() };
  return { userId: validated.user.id };
}

function view(record: Parameters<typeof describeWeekAccess>[0]) {
  return describeWeekAccess(record, new Date(), starPriceFromEnv(process.env.WEEK_STAR_PRICE));
}

export async function GET(req: Request) {
  const auth = authed(req);
  if ("error" in auth) return auth.error;
  const record = await loadWeekAccess(auth.userId);
  return NextResponse.json({ ok: true, access: view(record) });
}

export async function POST(req: Request) {
  const auth = authed(req);
  if ("error" in auth) return auth.error;

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

  const current = await loadWeekAccess(auth.userId);
  const next =
    action === "open"
      ? openWeekAccess(current, new Date())
      : markWeekIntroSeen(current);
  await saveWeekAccess(auth.userId, next);
  return NextResponse.json({ ok: true, access: view(next) });
}
