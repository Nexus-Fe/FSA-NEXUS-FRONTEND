import assert from "node:assert/strict";
import test from "node:test";
import {
  ORDER_STATUS, SUB_ORDER_STATUS, AUCTION_ORDER_STATUS, SHIPMENT_STATUS, REFUND_STATUS, REPORT_REFUND_STATUS, REPORT_STATUS, WITHDRAWAL_STATUS,
  WALLET_TRANSACTION_TYPE, SUBSIDY_BUDGET_STATUS, RECONCILIATION_FINDING_STATUS, REPUTATION_CHANGE_REASON,
  isKnownStatus, normalizeStatus, statusLabel,
} from "../src/lib/status-labels.ts";

test("spelling variants are the same key", () => {
  assert.equal(normalizeStatus("UnderReview"), normalizeStatus("UNDER_REVIEW"));
  assert.equal(normalizeStatus("[Returning]"), "RETURNING");
  assert.equal(statusLabel(REPORT_STATUS, "UNDER_REVIEW"), statusLabel(REPORT_STATUS, "UnderReview"));
});

test("User and Catalog report statuses read the same on one screen", () => {
  assert.equal(statusLabel(REPORT_STATUS, "UnderReview"), statusLabel(REPORT_STATUS, "Investigating"));
  assert.equal(statusLabel(REPORT_STATUS, "Rejected"), statusLabel(REPORT_STATUS, "Dismissed"));
  assert.equal(statusLabel(REPORT_STATUS, "Resolved"), "Đã xử lý");
});

test("shipment labels cover the failed-delivery and return steps and the bracketed timeline tokens", () => {
  for (const status of ["DeliveryFailed", "Returning", "Returned", "[Returning]", "[Returned]", "InTransit"]) {
    assert.ok(isKnownStatus(SHIPMENT_STATUS, status), status);
  }
  assert.match(statusLabel(SHIPMENT_STATUS, "[Returning]"), /hoàn/);
});

test("an order or sub-order table carries no shipment-only values", () => {
  for (const status of ["DeliveryFailed", "Returning", "Returned"]) {
    assert.equal(isKnownStatus(ORDER_STATUS, status), false, `order ${status}`);
    assert.equal(isKnownStatus(SUB_ORDER_STATUS, status), false, `sub-order ${status}`);
  }
});

test("withdrawal: Approved never reads as transferred; only Completed does; Cancelled exists", () => {
  assert.doesNotMatch(statusLabel(WITHDRAWAL_STATUS, "Approved"), /đã chuyển/i);
  assert.match(statusLabel(WITHDRAWAL_STATUS, "Approved"), /chờ chuyển khoản/);
  assert.equal(statusLabel(WITHDRAWAL_STATUS, "Completed"), "Đã chuyển tiền");
  assert.equal(statusLabel(WITHDRAWAL_STATUS, "Cancelled"), "Đã hủy");
});

test("every wallet transaction type of the back end has a label, so no raw code is shown", () => {
  const types = [
    "TopupVnpay", "PurchaseDebit", "RefundCredit", "EscrowCredit", "EscrowRelease", "WithdrawalDebit", "WithdrawalReversal", "PlatformFeeCredit",
    "AdjustmentCredit", "AdjustmentDebit", "DirectGatewayPayment", "TransferIn", "TransferOut", "TopupStripe", "AuctionHoldCapture",
    "AuctionForfeitCredit", "AuctionDepositRefund", "OrderPaymentAdjustmentDebit", "OrderPaymentAdjustmentRefund", "EscrowCancellationRefund",
    "PlatformSubsidyCredit",
  ];
  assert.equal(types.length, 21);
  for (const type of types) assert.ok(isKnownStatus(WALLET_TRANSACTION_TYPE, type), type);
});

test("the other tables cover their enums", () => {
  for (const s of ["PendingPayment", "PaymentProcessing", "Paid", "Cancelled", "Expired", "Completed", "Delivered"]) assert.ok(isKnownStatus(ORDER_STATUS, s), s);
  for (const s of ["PendingPayment", "Paid", "Confirmed", "SellerAccepted", "Shipping", "Shipped", "Delivered", "Completed", "Cancelled", "Refunded"]) assert.ok(isKnownStatus(SUB_ORDER_STATUS, s), s);
  for (const s of ["AwaitingPayment", "PendingPayment", "Paid", "Confirmed", "SellerAccepted", "Shipping", "Shipped", "Delivered", "Completed", "Cancelled", "Expired", "Refunded", "Returning", "Returned"]) assert.ok(isKnownStatus(AUCTION_ORDER_STATUS, s), s);
  for (const s of ["Requested", "WalletPending", "Completed", "Failed", "Rejected"]) assert.ok(isKnownStatus(REFUND_STATUS, s), s);
  for (const s of ["None", "Pending", "Refunded", "ManualProcessingRequired", "Failed"]) assert.ok(isKnownStatus(REPORT_REFUND_STATUS, s), s);
  for (const s of ["PendingApproval", "Active", "Closed"]) assert.ok(isKnownStatus(SUBSIDY_BUDGET_STATUS, s), s);
  for (const s of ["Open", "Investigating", "Resolved", "Accepted"]) assert.ok(isKnownStatus(RECONCILIATION_FINDING_STATUS, s), s);
  for (const s of ["PositiveReview", "NegativeReview", "OrderCompleted", "AuctionPaymentTimeout", "DisputeCompensation", "ManualAdjustment", "ViolationPenalty", "SellerCancellation", "ReportPenalty", "BuyerRefusedDelivery"]) assert.ok(isKnownStatus(REPUTATION_CHANGE_REASON, s), s);
});

test("a manual-processing refund is not shown as done", () => {
  assert.doesNotMatch(statusLabel(REPORT_REFUND_STATUS, "ManualProcessingRequired"), /đã hoàn/i);
});

test("an unknown value is shown as it arrived, an empty one as a dash, and isKnownStatus says which", () => {
  assert.equal(statusLabel(ORDER_STATUS, "SomethingNew"), "SomethingNew");
  assert.equal(isKnownStatus(ORDER_STATUS, "SomethingNew"), false);
  assert.equal(statusLabel(ORDER_STATUS, null), "—");
  assert.equal(statusLabel(ORDER_STATUS, ""), "—");
  assert.equal(isKnownStatus(ORDER_STATUS, undefined), false);
});
