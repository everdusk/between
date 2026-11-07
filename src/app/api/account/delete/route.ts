import { NextResponse } from "next/server";
import { actorFromRequest } from "@/lib/account-actor";
import { accountReady, accountUnavailable, clearSession } from "@/lib/account-http";
import { eraseActorData } from "@/lib/erase-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  const actor = await actorFromRequest(req);
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const erased = await eraseActorData(actor);
  if (!erased) return accountUnavailable();
  return clearSession(NextResponse.json({ ok: true }));
}
