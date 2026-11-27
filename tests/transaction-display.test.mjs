import assert from "node:assert/strict";
import test from "node:test";
import { isFullyDescribed, transactionDirection, transactionTypeLabel } from "../src/features/wallet/transaction-display.ts";

const ALL = ["TopupVnpay","PurchaseDebit","RefundCredit","EscrowCredit","EscrowRelease","WithdrawalDebit","WithdrawalReversal","PlatformFeeCredit","AdjustmentCredit","AdjustmentDebit","DirectGatewayPayment","TransferIn","TransferOut","TopupStripe","AuctionHoldCapture","AuctionForfeitCredit","AuctionDepositRefund","OrderPaymentAdjustmentDebit","OrderPaymentAdjustmentRefund","EscrowCancellationRefund","PlatformSubsidyCredit"];

test("every transaction type of the back end has a label and a direction, so no raw code is shown", () => {
  for (const type of ALL) assert.ok(isFullyDescribed(type), type);
});

test("the settlement V2 movements read correctly", () => {
  assert.equal(transactionDirection("EscrowRelease", "Success", 100), "credit");
  assert.equal(transactionDirection("PlatformSubsidyCredit", "Completed", 100), "credit");
  assert.equal(transactionDirection("AuctionHoldCapture", "Success", 100), "debit");
  assert.equal(transactionDirection("AuctionDepositRefund", "Success", 100), "credit");
  assert.equal(transactionDirection("EscrowCredit", "Success", 100), null, "no documented direction: no guessed sign");
  assert.match(transactionTypeLabel("PlatformSubsidyCredit"), /Trợ giá/);
});

test("a transaction that is not finished or has no amount shows no sign", () => {
  assert.equal(transactionDirection("TopupStripe", "Pending", 100), null);
  assert.equal(transactionDirection("TopupStripe", "Failed", 100), null);
  assert.equal(transactionDirection("TopupStripe", "Success", 0), null);
  assert.equal(transactionDirection("TopupStripe", "Success", Number.NaN), null);
});

test("an unknown type is shown as it arrived", () => {
  assert.equal(transactionTypeLabel("SomethingNew"), "SomethingNew");
  assert.equal(isFullyDescribed("SomethingNew"), false);
});
