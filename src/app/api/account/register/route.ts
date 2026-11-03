import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, withSession } from "@/lib/account-http";
import { createAccount, toPublicAccount } from "@/lib/web-account-store";
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
  if (!email) return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  if (passwordProblem(payload.password)) {
    return NextResponse.json({ ok: false, error: "short_password" }, { status: 400 });
  }
  const created = await createAccount(email, payload.password as string);
  if (created === "taken") {
    return NextResponse.json({ ok: false, error: "taken" }, { status: 409 });
  }
  if (!created) return accountUnavailable();
  return withSession(
    NextResponse.json({ ok: true, account: toPublicAccount(created) }),
    created.id,
  );
}
