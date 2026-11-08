import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { erasurePlan } from "./erase-account";

describe("erasure plan", () => {
  it("names the journal, the sign-in, and a linked messenger copy", () => {
    const plan = erasurePlan({
      storageIds: ["web:w1", "42", "max:7"],
      account: {
        id: "w1",
        email: "reader@example.com",
        telegramUserId: 42,
        maxUserId: 7,
        providers: {},
        resetTokenHash: "abc",
      },
    });
    assert.ok(plan.keys.includes("between:user:web:w1:store"));
    assert.ok(plan.keys.includes("between:user:42:store"));
    assert.ok(plan.keys.includes("between:user:max:7:store"));
    assert.ok(plan.keys.includes("between:acct:w1"));
    assert.ok(plan.keys.includes("between:acct:email:reader@example.com"));
    assert.ok(plan.keys.includes("between:acct:tg:42"));
    assert.ok(plan.keys.includes("between:acct:max:7"));
    assert.ok(plan.keys.includes("between:reset:abc"));
    assert.ok(plan.patterns.includes("between:digest:web:w1:*"));
    assert.equal(plan.keys.some((key) => key.startsWith("between:analytics")), false);
  });

  it("drops a storage id that could widen the scan", () => {
    const plan = erasurePlan({ storageIds: ["web:*"], account: null });
    assert.equal(plan.keys.length, 0);
    assert.equal(plan.patterns.length, 0);
  });
});
