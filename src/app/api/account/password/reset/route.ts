import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { completeReset, toPublicAccount } from "@/lib/web-account-store";
import { passwordProblem } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { token?: unknown; password?: unknown };
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token || token.length > 200) {
    return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  }
  if (passwordProblem(payload.password)) {
    return NextResponse.json({ ok: false, error: "short_password" }, { status: 400 });
  }
  const account = await completeReset(token, payload.password as string);
  if (account === null) return accountUnavailable();
  if (account === "bad") return NextResponse.json({ ok: false, error: "bad" }, { status: 400 });
  return withSession(NextResponse.json({ ok: true, account: toPublicAccount(account) }), account.id);
}
