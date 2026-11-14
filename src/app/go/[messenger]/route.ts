import { NextRequest, NextResponse } from "next/server";
import { ACQUISITION_COOKIE, messengerStartUrl } from "@/lib/acquisition";
import { createAcquisition } from "@/lib/acquisition-store";
import { getRedis } from "@/lib/redis";

/** The fixed destination also works before the landing's JS or Metrika has loaded. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ messenger: string }> }) {
  const { messenger } = await ctx.params;
  if (messenger !== "telegram" && messenger !== "max") return new NextResponse(null, { status: 404 });
  let ref: string | null = null;
  try {
    const redis = getRedis();
    if (redis) {
      const referer = req.headers.get("referer");
      const source = referer ? new URL(referer) : null;
      const yclid = source?.origin === req.nextUrl.origin ? source.searchParams.get("yclid") : null;
      ref = await createAcquisition(redis, {
        ref: req.nextUrl.searchParams.get("ref") ?? (source?.origin === req.nextUrl.origin ? source.searchParams.get("ref") : null) ?? req.cookies.get(ACQUISITION_COOKIE)?.value,
        clientId: req.cookies.get("_ym_uid")?.value,
        yclid,
      });
    }
  } catch {
    // Redis failure falls back to the original public bot link.
  }
  const response = NextResponse.redirect(messengerStartUrl(messenger, ref), 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
