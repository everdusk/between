import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { loginForSite, toPublicAccount } from "@/lib/web-account-store";
import { normalizeEmail, passwordProblem } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const payload = body as { email?: unknown; password?: unknown };
  const email = normalizeEmail(payload.email);
  if (!email || passwordProblem(payload.password) || typeof payload.password !== "string") {
    return NextResponse.json({ ok: false, error: "bad_login" }, { status: 401 });
  }
  const account = await loginForSite(email, payload.password);
  if (!account) return NextResponse.json({ ok: false, error: "bad_login" }, { status: 401 });
  return withSession(
    NextResponse.json({ ok: true, account: toPublicAccount(account) }),
    account.id,
  );
}
