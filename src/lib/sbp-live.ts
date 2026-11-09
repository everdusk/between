import { accountByEmail } from "./web-account-store";
import { webStorageId } from "./web-account";
import { claimPaymentCharge, getRedis, loadWeekAccess, releasePaymentCharge, saveWeekAccess } from "./redis";
import { recordSbpPaid, rememberSbpPayment, sbpPaymentBooked } from "./analytics";
import { rubPriceFromEnv } from "./week-access";
import {
  applyPendingSbp,
  fulfillSbp,
  sbpCapturedAt,
  sbpPaid,
  yookassaPaymentBody,
  yookassaReady,
  type SbpLedger,
  type SbpMessenger,
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
  messenger: SbpMessenger;
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
      body: JSON.stringify(yookassaPaymentBody({ ...input, monthly: rubPriceFromEnv(process.env.WEEK_RUB_PRICE) })),
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
  const paid = sbpPaid(payment, rubPriceFromEnv(process.env.WEEK_RUB_PRICE));
  if (!paid) return "open";
  const at = sbpCapturedAt(payment);
  const result = await fulfillSbp(paid, at, sbpLedger());
  // A second notice still counts. The charge id keeps it from being counted twice.
  await recordSbpPaid({
    userId: paid.actorId ?? paid.id,
    messenger: paid.messenger,
    plan: paid.plan,
    paymentId: paid.id,
    step: result === "pending" ? "pending" : "paid",
    at,
  });
  return result;
}

const CLAIM_PREFIX = "between:pay:yk:";

/** Payments already claimed, whose counter write was skipped. `/stats` calls this. */
export async function reconcileSbpPayments(limit = 8): Promise<void> {
  const redis = getRedis();
  if (!redis || !yookassaReady(process.env)) return;
  const ids: string[] = [];
  let cursor = 0;
  for (let page = 0; page < 5 && ids.length < limit; page += 1) {
    const [next, keys] = await redis.scan(cursor, { match: `${CLAIM_PREFIX}*`, count: 50 });
    cursor = Number(next);
    for (const key of keys) {
      const id = key.startsWith(CLAIM_PREFIX) ? key.slice(CLAIM_PREFIX.length) : "";
      if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || (await sbpPaymentBooked(id))) continue;
      ids.push(id);
      if (ids.length >= limit) break;
    }
    if (!Number.isFinite(cursor) || cursor === 0) break;
  }
  for (const id of ids) {
    const payment = await fetchSbpPayment(id);
    if (!payment) continue;
    const result = await settleSbpPayment(payment);
    if (result === "open") await rememberSbpPayment(id);
  }
}

export async function claimPendingSbp(email: string, ownerId: string): Promise<void> {
  await applyPendingSbp(email, ownerId, sbpLedger());
}
