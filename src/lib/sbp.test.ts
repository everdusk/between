import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyWeekAccess } from "./week-access";
import {
  applyPendingSbp,
  fulfillSbp,
  SBP_LEGAL_ID,
  SBP_MCC,
  SBP_MERCHANT_ID,
  SBP_PLANS,
  sbpPaid,
  sbpQrPayload,
  yookassaPaymentBody,
  yookassaReady,
  type SbpLedger,
} from "./sbp";

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "2c8f5b2e-1d3a-4e7b-9c10-aaaaaaaaaaaa",
    status: "succeeded",
    paid: true,
    amount: { value: "750.00", currency: "RUB" },
    metadata: {
      plan: "quarter",
      email: "masha@example.ru",
      actorId: "",
      legalId: SBP_LEGAL_ID,
      merchantId: SBP_MERCHANT_ID,
      mcc: SBP_MCC,
    },
    ...overrides,
  };
}

describe("sbp checkout", () => {
  it("asks YooKassa for an SBP QR at the mockup prices", () => {
    const body = yookassaPaymentBody({
      plan: "quarter",
      email: "masha@example.ru",
      actorId: null,
    });
    assert.equal(body.amount.value, "750.00");
    assert.equal(body.amount.currency, "RUB");
    assert.equal(body.confirmation.type, "qr");
    assert.equal(body.payment_method_data.type, "sbp");
    assert.equal(body.metadata.legalId, "LA0005911711");
    assert.equal(body.metadata.merchantId, "MA0007323535");
    assert.equal(body.metadata.mcc, "9999");
    assert.equal(body.receipt.customer.email, "masha@example.ru");
    assert.equal(SBP_PLANS.month.rub, 299);
    assert.equal(SBP_PLANS.year.rub, 2388);
    assert.equal(yookassaReady({ YOOKASSA_SHOP_ID: "123456", YOOKASSA_SECRET_KEY: "x".repeat(16) }), true);
    assert.equal(yookassaReady({ YOOKASSA_SHOP_ID: "", YOOKASSA_SECRET_KEY: "secret" }), false);
  });

  it("reads only an NSPK QR and a payment that matches the catalog", () => {
    assert.equal(sbpQrPayload({ confirmation: { type: "qr", confirmation_data: "https://qr.nspk.ru/AS1" } }), "https://qr.nspk.ru/AS1");
    assert.equal(sbpQrPayload({ confirmation: { type: "redirect", confirmation_data: "https://qr.nspk.ru/AS1" } }), null);
    assert.equal(sbpQrPayload({ confirmation: { type: "qr", confirmation_data: "https://evil.example/qr" } }), null);
    assert.ok(sbpPaid(payment()));
    assert.equal(sbpPaid(payment({ amount: { value: "1.00", currency: "RUB" } })), null);
    assert.equal(sbpPaid(payment({ metadata: { ...payment().metadata, merchantId: "MA0000000000" } })), null);
    assert.equal(sbpPaid(payment({ status: "pending", paid: false })), null);
  });

  it("extends the journal once and holds the receipt until the account exists", async () => {
    const access = new Map<string, ReturnType<typeof emptyWeekAccess>>();
    const pending = new Map<string, { paymentId: string; plan: "quarter"; paidUntil: string }>();
    const claimed = new Set<string>();
    const ledger: SbpLedger = {
      claim: async (id) => claimed.has(id) ? false : (claimed.add(id), true),
      release: async (id) => {
        claimed.delete(id);
      },
      loadAccess: async (owner) => access.get(owner) ?? emptyWeekAccess(),
      saveAccess: async (owner, record) => {
        access.set(owner, record);
      },
      ownerForEmail: async (email) => (email === "known@example.ru" ? "web:w" + "a".repeat(32) : null),
      readPending: async (email) => pending.get(email) ?? null,
      writePending: async (email, row) => {
        pending.set(email, { ...row, plan: "quarter" });
      },
      clearPending: async (email) => {
        pending.delete(email);
      },
    };
    const now = new Date("2026-11-09T00:00:00.000Z");
    const guest = payment({ metadata: { ...payment().metadata, email: "new@example.ru" } });
    const paid = sbpPaid(guest);
    assert.ok(paid);
    assert.equal(await fulfillSbp(paid, now, ledger), "pending");
    assert.equal(await fulfillSbp(paid, now, ledger), "again");
    const owner = "web:w" + "b".repeat(32);
    assert.equal(await applyPendingSbp("new@example.ru", owner, ledger), true);
    assert.equal(access.get(owner)?.paidUntil, "2027-02-07T00:00:00.000Z");
    assert.equal(await applyPendingSbp("new@example.ru", owner, ledger), false);
  });
});
