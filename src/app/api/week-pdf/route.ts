import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { getRedis, redisConfigured } from "@/lib/redis";
import { saveWeekPdfFile } from "@/lib/week-pdf-file";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function misconfigured() {
  return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
}

function publicOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

/** Keep a just-built sheet for a few minutes so Telegram Desktop can download it. */
export async function POST(req: Request) {
  if (!redisConfigured()) return misconfigured();
  const actor = await actorFromRequest(req);
  if (!actor) return unauthorized();
  const redis = getRedis();
  if (!redis) return misconfigured();

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ ok: false, error: "bad_pdf" }, { status: 400 });
  }

  try {
    const id = await saveWeekPdfFile(redis, bytes, req.headers.get("x-week-pdf-name") ?? "");
    const url = `${publicOrigin(req)}/api/week-pdf/${id}`;
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_pdf" }, { status: 400 });
  }
}
