import { newPasswordProblem } from "@/lib/account-validation";
import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { hashOtp, mailConfigFromEnv, newOtpCode, sendOtpMail } from "@/lib/otp-mail";
import { accountByEmail, OTP_RESEND_MS, saveSignup, signupRetryAfterSeconds } from "@/lib/web-account-store";
import { hashPassword, normalizeEmail, sessionSecret } from "@/lib/web-account";

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
  const problem = newPasswordProblem(payload.password);
  if (problem) {
    return NextResponse.json({ ok: false, error: problem === "composition" ? "weak_password" : "short_password" }, { status: 400 });
  }
  const secret = sessionSecret();
  if (!secret) return accountUnavailable();
  const [existing, retryAfterSeconds] = await Promise.all([
    accountByEmail(email),
    signupRetryAfterSeconds(email),
  ]);
  if (existing) return NextResponse.json({ ok: false, error: "taken" }, { status: 409 });
  if (retryAfterSeconds === null) return accountUnavailable();
  if (retryAfterSeconds > 0) {
    return NextResponse.json({ ok: false, error: "soon", retryAfterSeconds }, {
      status: 429, headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }
  const code = newOtpCode();
  const passwordRecord = await hashPassword(payload.password as string);
  try {
    await sendOtpMail(email, code);
  } catch {
    return NextResponse.json({ ok: false, error: "mail_fail" }, { status: 502 });
  }
  const saved = await saveSignup(email, passwordRecord.salt, passwordRecord.hash, hashOtp(code, secret));
  if (!saved) return accountUnavailable();
  return NextResponse.json({ ok: true, retryAfterSeconds: OTP_RESEND_MS / 1000 });
}
