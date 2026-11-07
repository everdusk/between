import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { hashOtp, mailConfigFromEnv, newOtpCode, sendOtpMail } from "@/lib/otp-mail";
import { accountByEmail, saveSignup, signupSendAllowed } from "@/lib/web-account-store";
import { hashPassword, normalizeEmail, passwordProblem, sessionSecret } from "@/lib/web-account";

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
  const payload = body as { email?: unknown; password?: unknown };
  const email = normalizeEmail(payload.email);
  if (!email) return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  if (passwordProblem(payload.password)) {
    return NextResponse.json({ ok: false, error: "short_password" }, { status: 400 });
  }
  const secret = sessionSecret();
  if (!secret) return accountUnavailable();
  const existing = await accountByEmail(email);
  if (existing) return NextResponse.json({ ok: false, error: "taken" }, { status: 409 });
  const allowed = await signupSendAllowed(email);
  if (allowed === "soon") return NextResponse.json({ ok: false, error: "soon" }, { status: 429 });
  if (allowed !== "ok") return accountUnavailable();
  const code = newOtpCode();
  const passwordRecord = await hashPassword(payload.password as string);
  try {
    await sendOtpMail(email, code);
  } catch {
    return NextResponse.json({ ok: false, error: "mail_fail" }, { status: 502 });
  }
  const saved = await saveSignup(email, passwordRecord.salt, passwordRecord.hash, hashOtp(code, secret));
  if (!saved) return accountUnavailable();
  return NextResponse.json({ ok: true });
}
