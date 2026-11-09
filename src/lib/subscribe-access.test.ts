import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SUBSCRIBE_LEAVE_SCRIPT, shouldLeaveSubscribe } from "./subscribe-access";

describe("subscribe access", () => {
  it("keeps a signed-in journal and a messenger launch", () => {
    assert.equal(shouldLeaveSubscribe({ signedIn: true, hash: "", storedMax: null }), false);
    assert.equal(
      shouldLeaveSubscribe({ signedIn: false, hash: "#WebAppData=abc", storedMax: null }),
      false,
    );
    assert.equal(
      shouldLeaveSubscribe({ signedIn: false, hash: "#tgWebAppData=abc", storedMax: null }),
      false,
    );
    assert.equal(shouldLeaveSubscribe({ signedIn: false, hash: "", storedMax: "launch" }), false);
  });

  it("sends a logged-out browser to the journal", () => {
    assert.equal(shouldLeaveSubscribe({ signedIn: false, hash: "", storedMax: null }), true);
    assert.equal(shouldLeaveSubscribe({ signedIn: false, hash: "#top", storedMax: "  " }), true);
    assert.match(SUBSCRIBE_LEAVE_SCRIPT, /location\.replace\("\/journal"\)/);
    assert.match(SUBSCRIBE_LEAVE_SCRIPT, /WebAppData/);
    assert.match(SUBSCRIBE_LEAVE_SCRIPT, /tgWebAppData/);
  });
});
