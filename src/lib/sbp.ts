import { normalizeEmail } from "./web-account";
import { isSbpPlan, sbpCatalog, sbpMoney, type SbpPlanId } from "./sbp-plans";
import {
  grantStackedPlan,
  grantWeekPaidUntil,
  paidUntilForPlan,
  type PremiumPlan,
  type WeekAccessRecord,
} from "./week-access";

/** NSPK identifiers for the Between merchant. They travel with each payment. */
export const SBP_LEGAL_ID = "LA0005911711";
export const SBP_MERCHANT_ID = "MA0007323535";
export const SBP_MCC = "9999";

export { isSbpPlan, sbpCatalog, sbpMoney, type SbpPlanId };

export function yookassaReady(env: Record<string, string | undefined>): boolean {
  const shop = env.YOOKASSA_SHOP_ID?.trim() ?? "";
  const secret = env.YOOKASSA_SECRET_KEY?.trim() ?? "";
  return /^\d{3,12}$/.test(shop) && secret.length >= 16;
}

export function yookassaPaymentBody(input: {
  plan: SbpPlanId;
  email: string;
  actorId: string | null;
  messenger?: SbpMessenger;
  monthly?: number;
}) {
  const plan = sbpCatalog(input.monthly)[input.plan];
  const value = sbpMoney(plan.rub);
  return {
    amount: { value, currency: "RUB" },
    capture: true,
    confirmation: { type: "qr" },
    payment_method_data: { type: "sbp" },
    description: `Between, подписка ${plan.span}`,
    metadata: {
      plan: input.plan,
      email: input.email,
      actorId: input.actorId ?? "",
      ...(input.messenger ? { messenger: input.messenger } : {}),
      legalId: SBP_LEGAL_ID,
      merchantId: SBP_MERCHANT_ID,
      mcc: SBP_MCC,
    },
    receipt: {
      customer: { email: input.email },
      items: [
        {
          description: `Between, подписка ${plan.span}`,
          quantity: "1.00",
          amount: { value, currency: "RUB" },
          vat_code: 1,
          payment_mode: "full_payment",
          payment_subject: "service",
        },
      ],
    },
  };
}

type YooPayment = {
  id?: unknown;
  status?: unknown;
  paid?: unknown;
  amount?: { value?: unknown; currency?: unknown };
  confirmation?: { type?: unknown; confirmation_data?: unknown };
  metadata?: Record<string, unknown>;
};

export function sbpQrPayload(payment: unknown): string | null {
  if (!payment || typeof payment !== "object") return null;
  const confirmation = (payment as YooPayment).confirmation;
  const data = confirmation?.confirmation_data;
  if (confirmation?.type !== "qr" || typeof data !== "string") return null;
  if (!/^https:\/\/qr\.nspk\.ru\//.test(data)) return null;
  return data;
}

export type SbpMessenger = "telegram" | "max" | "web";

/** When the bank captured the charge. The stat day follows this, not the later notice. */
export function sbpCapturedAt(payment: unknown, fallback = new Date()): Date {
  const raw = payment && typeof payment === "object" ? (payment as { captured_at?: unknown }).captured_at : null;
  if (typeof raw !== "string") return fallback;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? fallback : at;
}

function sameMoney(actual: unknown, expected: string): boolean {
  const parsed = typeof actual === "number" ? actual : typeof actual === "string" ? Number(actual) : NaN;
  return Number.isFinite(parsed) && parsed.toFixed(2) === expected;
}

function readMessenger(value: unknown, actorId: string | null): SbpMessenger {
  if (value === "telegram" || value === "max" || value === "web") return value;
  if (actorId?.startsWith("max:")) return "max";
  if (actorId && /^\d+$/.test(actorId)) return "telegram";
  return "web";
}

/** A succeeded payment we created: our merchant, the catalog price, a real email. */
export function sbpPaid(payment: unknown, monthly?: number): {
  id: string;
  plan: PremiumPlan;
  email: string;
  actorId: string | null;
  messenger: SbpMessenger;
} | null {
  if (!payment || typeof payment !== "object") return null;
  const row = payment as YooPayment;
  if (row.status !== "succeeded") return null;
  if (row.paid === false || row.paid === "false") return null;
  if (row.amount?.currency !== "RUB") return null;
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  const meta = row.metadata ?? {};
  if (meta.legalId !== SBP_LEGAL_ID || meta.merchantId !== SBP_MERCHANT_ID || meta.mcc !== SBP_MCC) {
    return null;
  }
  if (!isSbpPlan(meta.plan)) return null;
  const email = normalizeEmail(meta.email);
  if (!email) return null;
  if (!sameMoney(row.amount.value, sbpMoney(sbpCatalog(monthly)[meta.plan].rub))) return null;
  const actor = typeof meta.actorId === "string" ? safeOwner(meta.actorId) : null;
  return {
    id: row.id.trim(),
    plan: meta.plan,
    email,
    actorId: actor,
    messenger: readMessenger(meta.messenger, actor),
  };
}

/** Journal ids we are willing to extend. Anything else stays on the email. */
export function safeOwner(value: string): string | null {
  const id = value.trim();
  if (/^web:w[a-f0-9]{32}$/.test(id)) return id;
  if (/^max:\d{1,16}$/.test(id)) return id;
  if (/^\d{1,16}$/.test(id)) return id;
  return null;
}

export type SbpPending = { paymentId: string; plan: PremiumPlan; paidUntil: string };

export type SbpLedger = {
  claim: (paymentId: string) => Promise<boolean>;
  release: (paymentId: string) => Promise<void>;
  loadAccess: (ownerId: string) => Promise<WeekAccessRecord>;
  saveAccess: (ownerId: string, record: WeekAccessRecord) => Promise<void>;
  ownerForEmail: (email: string) => Promise<string | null>;
  readPending: (email: string) => Promise<SbpPending | null>;
  writePending: (email: string, pending: SbpPending) => Promise<void>;
  clearPending: (email: string) => Promise<void>;
};

/** One succeeded payment extends one journal. A second notice does not extend it again. */
export async function fulfillSbp(
  paid: { id: string; plan: PremiumPlan; email: string; actorId: string | null },
  now: Date,
  ledger: SbpLedger,
): Promise<"granted" | "pending" | "again"> {
  const claimed = await ledger.claim(paid.id);
  if (!claimed) return "again";
  const paidUntil = paidUntilForPlan(paid.plan, now);
  try {
    const owner = paid.actorId ?? (await ledger.ownerForEmail(paid.email));
    if (!owner) {
      await ledger.writePending(paid.email, { paymentId: paid.id, plan: paid.plan, paidUntil });
      return "pending";
    }
    const current = await ledger.loadAccess(owner);
    await ledger.saveAccess(owner, grantStackedPlan(current, paid.plan, now));
    return "granted";
  } catch (error) {
    await ledger.release(paid.id);
    throw error;
  }
}

/** Moves a receipt that arrived before the journal existed onto that journal. */
export async function applyPendingSbp(
  email: string,
  ownerId: string,
  ledger: Pick<SbpLedger, "readPending" | "clearPending" | "loadAccess" | "saveAccess">,
): Promise<boolean> {
  const owner = safeOwner(ownerId);
  if (!owner) return false;
  const pending = await ledger.readPending(email);
  if (!pending) return false;
  const current = await ledger.loadAccess(owner);
  const now = new Date();
  const paidMs = current.paidUntil ? Date.parse(current.paidUntil) : NaN;
  const stillPaid = Number.isFinite(paidMs) && paidMs > now.getTime();
  await ledger.saveAccess(
    owner,
    stillPaid ? grantStackedPlan(current, pending.plan, now) : grantWeekPaidUntil(current, pending.paidUntil),
  );
  await ledger.clearPending(email);
  return true;
}
