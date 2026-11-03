import { NextResponse } from "next/server";
import { accountReady, accountUnavailable } from "@/lib/account-http";
import { hashOtp, mailConfigFromEnv, newOtpCode, sendOtpMail } from "@/lib/otp-mail";
import { otpSendAllowed, saveOtp } from "@/lib/web-account-store";
import { normalizeEmail, sessionSecret } from "@/lib/web-account";

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
  const allowed = await otpSendAllowed(email);
  if (allowed === "soon") return NextResponse.json({ ok: false, error: "soon" }, { status: 429 });
  if (allowed !== "ok") return accountUnavailable();
  const secret = sessionSecret();
  if (!secret) return accountUnavailable();
  const code = newOtpCode();
  try {
    await sendOtpMail(email, code);
  } catch {
    return NextResponse.json({ ok: false, error: "mail_fail" }, { status: 502 });
  }
  const saved = await saveOtp(email, hashOtp(code, secret));
  if (!saved) return accountUnavailable();
  return NextResponse.json({ ok: true });
}
