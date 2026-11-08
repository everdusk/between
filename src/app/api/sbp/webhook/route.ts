import { NextResponse } from "next/server";
import { redisConfigured } from "@/lib/redis";
import { fetchSbpPayment, settleSbpPayment } from "@/lib/sbp-live";

/** YooKassa tells us a payment changed. The body is only a hint: the payment is read back. */
export async function POST(req: Request) {
  if (!redisConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const object = (body as { object?: { id?: unknown } }).object;
  const id = typeof object?.id === "string" ? object.id : "";
  const payment = await fetchSbpPayment(id);
  if (payment) await settleSbpPayment(payment);
  return NextResponse.json({ ok: true });
}
