import { accountByEmail } from "./web-account-store";
import { webStorageId } from "./web-account";
import { claimPaymentCharge, getRedis, loadWeekAccess, releasePaymentCharge, saveWeekAccess } from "./redis";
import {
  applyPendingSbp,
  fulfillSbp,
  sbpPaid,
  yookassaPaymentBody,
  yookassaReady,
  type SbpLedger,
  type SbpPending,
  type SbpPlanId,
} from "./sbp";

const API = "https://api.yookassa.ru/v3/payments";
const PENDING_TTL = 60 * 60 * 24 * 400;

function authHeader(): string | null {
  if (!yookassaReady(process.env)) return null;
  const shop = process.env.YOOKASSA_SHOP_ID!.trim();
  const secret = process.env.YOOKASSA_SECRET_KEY!.trim();
  return `Basic ${Buffer.from(`${shop}:${secret}`).toString("base64")}`;
}

function pendingKey(email: string): string {
  return `between:sbp:pending:${email}`;
}

export function sbpLedger(): SbpLedger {
  return {
    claim: (paymentId) => claimPaymentCharge(`yk:${paymentId}`),
    release: (paymentId) => releasePaymentCharge(`yk:${paymentId}`),
    loadAccess: (ownerId) => loadWeekAccess(ownerId),
    saveAccess: (ownerId, record) => saveWeekAccess(ownerId, record),
    ownerForEmail: async (email) => {
      const account = await accountByEmail(email);
      return account ? webStorageId(account.id) : null;
    },
    readPending: async (email) => {
      const redis = getRedis();
      if (!redis) return null;
      const row = await redis.get<SbpPending>(pendingKey(email));
      if (!row || typeof row !== "object") return null;
      if (row.plan !== "month" && row.plan !== "quarter" && row.plan !== "year") return null;
      if (typeof row.paidUntil !== "string" || typeof row.paymentId !== "string") return null;
      return row;
    },
    writePending: async (email, pending) => {
      const redis = getRedis();
      if (!redis) return;
      await redis.set(pendingKey(email), pending, { ex: PENDING_TTL });
    },
    clearPending: async (email) => {
      const redis = getRedis();
      if (!redis) return;
      await redis.del(pendingKey(email));
    },
  };
}

export async function createSbpPayment(input: {
  plan: SbpPlanId;
  email: string;
  actorId: string | null;
}): Promise<{ ok: true; id: string; qr: string } | { ok: false; error: "not_configured" | "rejected"; detail?: string }> {
  const header = authHeader();
  if (!header) return { ok: false, error: "not_configured" };
  let response: Response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: header,
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(yookassaPaymentBody(input)),
    });
  } catch {
    return { ok: false, error: "rejected", detail: "ЮKassa не ответила" };
  }
  const body = (await response.json().catch(() => null)) as {
    id?: unknown;
    confirmation?: { type?: unknown; confirmation_data?: unknown };
    description?: unknown;
  } | null;
  const qr = body?.confirmation?.type === "qr" && typeof body.confirmation.confirmation_data === "string"
    ? body.confirmation.confirmation_data
    : null;
  if (!response.ok || typeof body?.id !== "string" || !qr?.startsWith("https://qr.nspk.ru/")) {
    const detail = typeof body?.description === "string" ? body.description.slice(0, 180) : undefined;
    return { ok: false, error: "rejected", detail };
  }
  return { ok: true, id: body.id, qr };
}

/** The notice is not trusted. The payment is read back from YooKassa. */
export async function fetchSbpPayment(id: string): Promise<unknown | null> {
  const header = authHeader();
  if (!header || !/^[A-Za-z0-9-]{8,64}$/.test(id)) return null;
  try {
    const response = await fetch(`${API}/${id}`, { headers: { Authorization: header } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function settleSbpPayment(payment: unknown): Promise<"granted" | "pending" | "again" | "open"> {
  const paid = sbpPaid(payment);
  if (!paid) return "open";
  return fulfillSbp(paid, new Date(), sbpLedger());
}

export async function claimPendingSbp(email: string, ownerId: string): Promise<void> {
  await applyPendingSbp(email, ownerId, sbpLedger());
}
