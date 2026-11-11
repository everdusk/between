import { NextResponse } from "next/server";
import { getRedis, redisConfigured } from "@/lib/redis";
import { loadWeekPdfFile } from "@/lib/week-pdf-file";

/** The secret in the path is the permission. Telegram's downloader has no journal cookie. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!redisConfigured()) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const file = await loadWeekPdfFile(redis, id);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
