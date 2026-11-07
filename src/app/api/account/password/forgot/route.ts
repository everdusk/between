import { NextResponse } from "next/server";
import { accountReady, accountUnavailable, requestOrigin } from "@/lib/account-http";
import { mailConfigFromEnv, sendResetMail } from "@/lib/otp-mail";
import { finishResetMail, prepareReset, revokeReset } from "@/lib/web-account-store";
import { normalizeEmail, resetUrl } from "@/lib/web-account";

export async function POST(req: Request) {
  if (!accountReady()) return accountUnavailable();
  if (!mailConfigFromEnv()) {
    return NextResponse.json({ ok: false, error: "mail_off" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const email = normalizeEmail((body as { email?: unknown }).email);
  if (!email) return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  const prepared = await prepareReset(email);
  if (prepared === "soon") return NextResponse.json({ ok: false, error: "soon" }, { status: 429 });
  if (prepared === null) return accountUnavailable();
  if (prepared === "absent") {
    await finishResetMail(email);
    return NextResponse.json({ ok: true });
  }
  try {
    await sendResetMail(email, resetUrl(requestOrigin(req), prepared.token));
  } catch {
    await revokeReset(prepared.token);
    return NextResponse.json({ ok: false, error: "mail_fail" }, { status: 502 });
  }
  await finishResetMail(email);
  return NextResponse.json({ ok: true });
}
