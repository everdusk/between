import { NextResponse } from "next/server";
import { loadWeekAccess, redisConfigured, saveWeekAccess } from "@/lib/redis";
import { validateInitData } from "@/lib/telegram-auth";
import {
  describeWeekAccess,
  isWeekAccessExempt,
  markWeekIntroSeen,
  openWeekAccess,
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

function authed(req: Request) {
  if (!redisConfigured() || !process.env.BOT_TOKEN?.trim()) return { error: misconfigured() };
  const initData = req.headers.get("x-telegram-init-data");
  if (!initData) return { error: unauthorized() };
  const validated = validateInitData(initData);
  if (!validated) return { error: unauthorized() };
  return { user: validated.user };
}

function view(record: WeekAccessRecord, user: WeekAccessIdentity) {
  return describeWeekAccess(record, new Date(), starPriceFromEnv(process.env.WEEK_STAR_PRICE), {
    exempt: isWeekAccessExempt(user, process.env.WEEK_EXEMPT_USER_IDS),
  });
}

export async function GET(req: Request) {
  const auth = authed(req);
  if ("error" in auth) return auth.error;
  const record = await loadWeekAccess(auth.user.id);
  return NextResponse.json({ ok: true, access: view(record, auth.user) });
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

  const current = await loadWeekAccess(auth.user.id);
  const next =
    action === "open"
      ? openWeekAccess(current, new Date())
      : markWeekIntroSeen(current);
  await saveWeekAccess(auth.user.id, next);
  return NextResponse.json({ ok: true, access: view(next, auth.user) });
}
