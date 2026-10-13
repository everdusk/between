import { NextResponse } from "next/server";
import { loadUserStore, redisConfigured } from "@/lib/redis";
import { currentBotToken, webSessionFromRequest } from "@/lib/web-session";

export async function GET(req: Request) {
  if (!currentBotToken() || !redisConfigured()) {
    return NextResponse.json({ ok: false, error: "server_not_configured" }, { status: 503 });
  }
  const session = webSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const store = await loadUserStore(session.uid);
  const entries = [...store.entries].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return NextResponse.json({
    ok: true,
    name: session.name,
    entries,
  });
}
