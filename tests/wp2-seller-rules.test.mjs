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

import { canToggle, changedPreferences, otherSessionCount, signedPoints, sortSessions, validateKycFile } from "@/features/account/account-rules.ts";

test("sessions: current first, then newest", () => {
  const list = sortSessions([{ sessionId: "a", lastActiveAt: "2026-01-01", isCurrent: false }, { sessionId: "b", lastActiveAt: "2026-02-01", isCurrent: false }, { sessionId: "c", lastActiveAt: "2025-01-01", isCurrent: true }]);
  assert.deepEqual(list.map((s) => s.sessionId), ["c", "b", "a"]);
  assert.equal(otherSessionCount(list), 2);
});

test("preferences: mandatory or disabled channel cannot toggle; only real changes are sent", () => {
  const rows = [
    { notificationType: "Otp", channelCode: "Email", isDisabled: false, isMandatory: true, isChannelDisabled: false },
    { notificationType: "AuctionStart", channelCode: "Push", isDisabled: false, isMandatory: false, isChannelDisabled: false },
    { notificationType: "AuctionStart", channelCode: "Email", isDisabled: true, isMandatory: false, isChannelDisabled: true },
  ];
  assert.equal(canToggle(rows[0]), false);
  assert.equal(canToggle(rows[2]), false);
  const edited = new Map([["Otp:Email", true], ["AuctionStart:Push", true], ["AuctionStart:Email", false]]);
  assert.deepEqual(changedPreferences(rows, edited), [{ notificationType: "AuctionStart", channelCode: "Push", isDisabled: true }]);
});

test("kyc file rules", () => {
  assert.equal(validateKycFile({ name: "a.JPG", size: 1000 }, true), null);
  assert.ok(validateKycFile(null, true));
  assert.equal(validateKycFile(null, false), null);
  assert.ok(validateKycFile({ name: "a.gif", size: 10 }, true));
  assert.ok(validateKycFile({ name: "a.pdf", size: 6 * 1024 * 1024 }, true));
  assert.equal(signedPoints(5), "+5");
  assert.equal(signedPoints(-3), "-3");
});

import { describeWarehouseRetry } from "@/features/staff/warehouse-retry-rules.ts";
test("warehouse retry messages", () => {
  assert.match(describeWarehouseRetry({ warehouseReady: true }), /sẵn sàng/);
  assert.match(describeWarehouseRetry({ warehouseReady: false }), /Chưa tạo được/);
});
