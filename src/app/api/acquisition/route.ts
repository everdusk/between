import { NextRequest, NextResponse } from "next/server";
import { ACQUISITION_COOKIE, ACQUISITION_TTL } from "@/lib/acquisition";
import { createAcquisition } from "@/lib/acquisition-store";
import { landingQrSvg } from "@/lib/landing-qr";
import { LANDING_OPEN_URL } from "@/lib/landing";
import { getRedis } from "@/lib/redis";

export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (req.headers.get("origin") !== req.nextUrl.origin) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  if (Number(req.headers.get("content-length")) > 2048) return NextResponse.json({ error: "too_large" }, { status: 413, headers });
  try {
    const text = await req.text();
    if (text.length > 2048) return NextResponse.json({ error: "too_large" }, { status: 413, headers });
    const input = JSON.parse(text) as { clientId?: unknown; yclid?: unknown; ref?: unknown };
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "bad_input" }, { status: 400, headers });
    const redis = getRedis();
    if (!redis) return NextResponse.json({ ref: null }, { headers });
    const ref = await createAcquisition(redis, {
      ...input,
      ref: input.ref ?? req.cookies.get(ACQUISITION_COOKIE)?.value,
    });
    const openUrl = new URL(LANDING_OPEN_URL);
    if (ref) openUrl.searchParams.set("ref", ref);
    const response = NextResponse.json({ ref, qr: ref ? await landingQrSvg(openUrl.toString()) : null }, { headers });
    if (ref) response.cookies.set(ACQUISITION_COOKIE, ref, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: ACQUISITION_TTL });
    return response;
  } catch {
    // Attribution must never stop the visitor opening a messenger.
    return NextResponse.json({ ref: null }, { headers });
  }
}
