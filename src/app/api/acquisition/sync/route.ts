import { NextResponse } from "next/server";
import { ACQUISITION_PENDING, ACQUISITION_SYNC } from "@/lib/acquisition-store";
import { syncAcquisition } from "@/lib/acquisition-sync";
import { getRedis } from "@/lib/redis";

export const maxDuration = 30;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  return NextResponse.json({
    configured: Boolean(process.env.METRIKA_OAUTH_TOKEN?.trim()),
    pending: await redis.zcard(ACQUISITION_PENDING),
    lastUpload: await redis.get(ACQUISITION_SYNC),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const result = await syncAcquisition(redis);
  return NextResponse.json(result, { status: result.status === "error" ? 502 : 200, headers: { "Cache-Control": "no-store" } });
}
