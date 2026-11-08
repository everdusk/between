import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { accountReady, accountUnavailable, clearSession } from "@/lib/account-http";
import { eraseActorData } from "@/lib/erase-account";

/** Erases the signed-in journal. The body must ask for it on purpose. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const actor = await actorFromRequest(req);
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if ((body as { confirm?: unknown }).confirm !== "erase") {
    return NextResponse.json({ ok: false, error: "confirm" }, { status: 400 });
  }
  try {
    const erased = await eraseActorData(actor);
    if (!erased) return accountUnavailable();
  } catch {
    return NextResponse.json({ ok: false, error: "erase_fail" }, { status: 502 });
  }
  return clearSession(NextResponse.json({ ok: true }));
}
