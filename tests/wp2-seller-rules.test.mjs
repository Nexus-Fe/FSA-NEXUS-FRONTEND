import test from "node:test";
import assert from "node:assert/strict";
import { asAlertList, parseThreshold, sortLowStock } from "@/features/seller/inventory-alerts.ts";
import { canConfirmReturn, describeConfirmReturn } from "@/features/seller/return-rules.ts";

test("asAlertList accepts array, envelope and junk", () => {
  assert.deepEqual(asAlertList([1]), [1]);
  assert.deepEqual(asAlertList({ data: [2] }), [2]);
  assert.deepEqual(asAlertList(null), []);
});

test("parseThreshold validates whole numbers within range", () => {
  assert.deepEqual(parseThreshold(" 12 "), { value: 12 });
  assert.ok("error" in parseThreshold("-1"));
  assert.ok("error" in parseThreshold("1.5"));
  assert.ok("error" in parseThreshold("1000001"));
});

test("sortLowStock puts the emptiest first", () => {
  const a = { availableQuantity: 5, minStockThreshold: 10 };
  const b = { availableQuantity: 0, minStockThreshold: 10 };
  assert.equal(sortLowStock([a, b])[0], b);
});

test("canConfirmReturn looks at the last timeline step", () => {
  assert.equal(canConfirmReturn([{ status: "InTransit" }, { status: "Returning" }]), true);
  assert.equal(canConfirmReturn([{ status: "Returning" }, { status: "Delivered" }]), false);
  assert.equal(canConfirmReturn([]), false);
});

test("describeConfirmReturn separates repeat from first confirmation", () => {
  assert.equal(describeConfirmReturn({ code: "ALREADY_RETURNED" }).restored, false);
  assert.equal(describeConfirmReturn({ data: { restoredStock: 3 } }).restored, true);
});

import { asRefundPage, canDecideRefund, parseRejectReason } from "@/features/refunds/refund-rules.ts";

test("refund rules: only non-buyers decide a Requested refund", () => {
  assert.equal(canDecideRefund("seller", "Requested"), true);
  assert.equal(canDecideRefund("buyer", "Requested"), false);
  assert.equal(canDecideRefund("admin", "Completed"), false);
});

test("refund rules: reject reason is required and bounded", () => {
  assert.ok("error" in parseRejectReason("   "));
  assert.ok("error" in parseRejectReason("x".repeat(501)));
  assert.deepEqual(parseRejectReason(" hết hàng "), { value: "hết hàng" });
});

test("asRefundPage tolerates an envelope and junk", () => {
  assert.equal(asRefundPage({ data: { items: [{ id: "1" }], pagination: { totalPages: 3 } } }).pagination.totalPages, 3);
  assert.equal(asRefundPage(null).items.length, 0);
});
