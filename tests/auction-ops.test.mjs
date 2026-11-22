import assert from "node:assert/strict";
import test from "node:test";
import { attentionReasons, canInvalidateBid, checkOpsReason } from "../src/features/auction/ops.service.ts";

test("a bid can be invalidated only on a running auction and only once", () => {
  assert.equal(canInvalidateBid("Running", { isInvalidated: false }), true);
  assert.equal(canInvalidateBid("Running", { isInvalidated: true }), false);
  for (const status of ["Scheduled", "Ended", "Settled", "Cancelled"]) assert.equal(canInvalidateBid(status, {}), false, status);
});

test("the reason must be 3 to 500 characters", () => {
  assert.ok(checkOpsReason(""));
  assert.ok(checkOpsReason("ab"));
  assert.equal(checkOpsReason("gian lận giá"), null);
  assert.ok(checkOpsReason("x".repeat(501)));
});

test("the attention reasons are named", () => {
  assert.deepEqual(attentionReasons({ hasAttentionDeposit: true, hasOverdueSettlement: true }), ["Có khoản cọc đang kẹt", "Quyết toán quá hạn"]);
  assert.deepEqual(attentionReasons({ hasAttentionDeposit: false, hasOverdueSettlement: false }), []);
});
