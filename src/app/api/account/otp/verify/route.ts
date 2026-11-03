import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { consumeOtp, openAccountByEmail, toPublicAccount } from "@/lib/web-account-store";
import { normalizeEmail, sessionSecret } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { email?: unknown; code?: unknown };
  const email = normalizeEmail(payload.email);
  const code = typeof payload.code === "string" ? payload.code.trim() : "";
  if (!email) return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "bad" }, { status: 401 });
  const secret = sessionSecret();
  if (!secret) return accountUnavailable();
  const result = await consumeOtp(email, code, secret);
  if (result === null) return accountUnavailable();
  if (result !== "ok") return NextResponse.json({ ok: false, error: "bad" }, { status: 401 });
  const account = await openAccountByEmail(email);
  if (!account) return accountUnavailable();
  return withSession(NextResponse.json({ ok: true, account: toPublicAccount(account) }), account.id);
}
