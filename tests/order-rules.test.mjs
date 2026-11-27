import assert from "node:assert/strict";
import test from "node:test";
import { canChangeAddress, canCompleteOrder, canRepay, describeBuyerOrderStatus, describeFeeChange, isCodPaymentMethod } from "../src/features/commerce/order-rules.ts";

const NOW = Date.parse("2026-11-23T10:00:00Z");
const future = "2026-11-23T10:10:00Z";
const past = "2026-11-23T09:50:00Z";

test("repay needs PendingPayment, a future deadline and a non-COD order", () => {
  assert.equal(canRepay({ status: "PendingPayment", paymentDeadlineAt: future }, [{ status: "PendingPayment", paymentMethod: "Wallet" }], NOW), true);
  assert.equal(canRepay({ status: "PendingPayment", paymentDeadlineAt: past }, [], NOW), false);
  assert.equal(canRepay({ status: "Paid", paymentDeadlineAt: future }, [], NOW), false);
  assert.equal(canRepay({ status: "PendingPayment", paymentDeadlineAt: future }, [{ status: "PendingPayment", paymentMethod: "Cod" }], NOW), false);
  assert.equal(canRepay({ status: "PendingPayment" }, [], NOW), false);
});

test("complete needs every active sub-order delivered or completed, at least one still to complete", () => {
  const done = (status) => ({ status });
  assert.equal(canCompleteOrder({ status: "Delivered" }, [done("Delivered"), done("Delivered")]), true);
  assert.equal(canCompleteOrder({ status: "Paid" }, [done("Delivered"), done("Completed")]), true);
  assert.equal(canCompleteOrder({ status: "Paid" }, [done("Delivered"), done("Shipping")]), false);
  assert.equal(canCompleteOrder({ status: "Paid" }, [done("Delivered"), done("Cancelled")]), true);
  assert.equal(canCompleteOrder({ status: "Paid" }, [done("Cancelled")]), false);
  assert.equal(canCompleteOrder({ status: "Completed" }, [done("Completed")]), false);
  assert.equal(canCompleteOrder({ status: "Paid" }, [done("Completed"), done("Completed")]), false);
  assert.equal(canCompleteOrder({ status: "Cancelled" }, [done("Delivered")]), false);
  assert.equal(canCompleteOrder({ status: "Expired" }, [done("Delivered")]), false);
});

test("address change is offered only before shipping starts", () => {
  for (const status of ["PendingPayment", "Paid", "Confirmed", "SellerAccepted"]) assert.equal(canChangeAddress({ status }), true, status);
  for (const status of ["Shipping", "Shipped", "Delivered", "Completed", "Cancelled", "Refunded"]) assert.equal(canChangeAddress({ status }), false, status);
});

test("fee change direction", () => {
  assert.equal(describeFeeChange(30000, 40000), "up");
  assert.equal(describeFeeChange(30000, 20000), "down");
  assert.equal(describeFeeChange(30000, 30000), "same");
});

test("buyer order status labels distinguish COD from Wallet", () => {
  assert.equal(isCodPaymentMethod("Cod"), true);
  assert.equal(isCodPaymentMethod("Wallet"), false);
  assert.equal(describeBuyerOrderStatus("PendingPayment", "Cod"), "Chờ người bán xác nhận (COD)");
  assert.equal(describeBuyerOrderStatus("PendingPayment", "Wallet"), "Chờ thanh toán");
  assert.equal(describeBuyerOrderStatus("SellerRejected", "Cod"), "Đã bị từ chối");
  assert.equal(describeBuyerOrderStatus("SellerRejected", "Wallet"), "Đã bị từ chối · Đã hoàn tiền");
});
