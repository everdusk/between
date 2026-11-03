import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { erasurePlan } from "./erase-account";

describe("full deletion", () => {
  it("lists the journal, the sign-in, and the linked Telegram copy", () => {
    const plan = erasurePlan({
      storageIds: ["web:wabc", "42"],
      account: {
        id: "wabc",
        email: "ada@example.com",
        telegramUserId: 42,
        providers: { yandex: "ya-1" },
      },
    });
    assert.ok(plan.keys.includes("between:user:web:wabc:store"));
    assert.ok(plan.keys.includes("between:user:42:week-access"));
    assert.ok(plan.keys.includes("between:acct:wabc"));
    assert.ok(plan.keys.includes("between:acct:email:ada@example.com"));
    assert.ok(plan.keys.includes("between:otp:ada@example.com"));
    assert.ok(plan.keys.includes("between:acct:tg:42"));
    assert.ok(plan.keys.includes("between:acct:oauth:yandex:ya-1"));
    assert.equal(plan.keys.includes("between:acct:oauth:vk:ya-1"), false);
    assert.ok(plan.patterns.includes("between:user:web:wabc:brief:*"));
    assert.ok(plan.patterns.includes("between:digest:42:*"));
    assert.deepEqual(plan.users, ["web:wabc", "42"]);
    assert.equal(plan.keys.some((key) => key.includes(":99:")), false);
  });

  it("leaves a stranger's account out when only a Telegram journal is named", () => {
    const plan = erasurePlan({ storageIds: ["7"], account: null });
    assert.ok(plan.keys.includes("between:user:7:store"));
    assert.equal(plan.keys.some((key) => key.startsWith("between:acct:")), false);
  });
});
