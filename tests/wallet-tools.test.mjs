import assert from "node:assert/strict";
import test from "node:test";
import { validateResolveReason } from "../src/features/admin/finance/wallet-tools.service.ts";

test("a Stripe attempt can only be resolved with a reason of 3 to 500 characters", () => {
  assert.equal(validateResolveReason("Đã kiểm tra Stripe, không thu tiền"), null);
  assert.ok(validateResolveReason("ab"));
  assert.ok(validateResolveReason("   "));
  assert.ok(validateResolveReason("x".repeat(501)));
  assert.equal(validateResolveReason("x".repeat(500)), null);
});
