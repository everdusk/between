import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { loginTokenFromStart } from "@/lib/web-account";
import { takeMaxLogin, toPublicAccount } from "@/lib/web-account-store";

/** The browser that opened MAX picks up the session after Start. */
export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const token = loginTokenFromStart(`login_${String((body as { token?: unknown }).token ?? "")}`);
  if (!token) return NextResponse.json({ ok: false, error: "bad_token" }, { status: 400 });
  const account = await takeMaxLogin(token);
  if (!account) return NextResponse.json({ ok: true, pending: true });
  return withSession(
    NextResponse.json({ ok: true, pending: false, account: toPublicAccount(account) }),
    account.id,
  );
}
