import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { actorFromRequest } from "@/lib/account-actor";
import { redisConfigured } from "@/lib/redis";
import { createSbpPayment, fetchSbpPayment, settleSbpPayment } from "@/lib/sbp-live";
import { sbpQrPayload } from "@/lib/sbp";
import { isSbpPlan, sbpCatalog } from "@/lib/sbp-plans";
import { rubPriceFromEnv } from "@/lib/week-access";
import { normalizeEmail } from "@/lib/web-account";

function misconfigured() {
  return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
}

export async function POST(req: Request) {
  if (!redisConfigured()) return misconfigured();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const plan = (body as { plan?: unknown }).plan;
  const email = normalizeEmail((body as { email?: unknown }).email);
  if (!isSbpPlan(plan) || !email) {
    return NextResponse.json({ ok: false, error: "bad_payment" }, { status: 400 });
  }
  const actor = await actorFromRequest(req);
  const created = await createSbpPayment({ plan, email, actorId: actor?.id ?? null });
  if (!created.ok) {
    const status = created.error === "not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: created.error, detail: created.detail }, { status });
  }
  const svg = await QRCode.toString(created.qr, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
  return NextResponse.json({
    ok: true,
    paymentId: created.id,
    amount: sbpCatalog(rubPriceFromEnv(process.env.WEEK_RUB_PRICE))[plan].rub,
    plan,
    url: created.qr,
    svg,
  });
}

export async function GET(req: Request) {
  if (!redisConfigured()) return misconfigured();
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  const payment = await fetchSbpPayment(id);
  if (!payment) return NextResponse.json({ ok: false, error: "unknown" }, { status: 404 });
  const result = await settleSbpPayment(payment);
  const qr = sbpQrPayload(payment);
  return NextResponse.json({ ok: true, status: result, qr: Boolean(qr) });
}
