import test from "node:test";
import assert from "node:assert/strict";
import {
  canSellerAccept,
  describeSellerOrderStatus,
  isCodPayment,
  paymentMethodLabel,
  sellerOrderStatusTone,
} from "@/features/seller/seller-order-rules.ts";

test("isCodPayment is case-insensitive and ignores surrounding whitespace", () => {
  assert.equal(isCodPayment("Cod"), true);
  assert.equal(isCodPayment("COD"), true);
  assert.equal(isCodPayment(" cod "), true);
  assert.equal(isCodPayment("Wallet"), false);
  assert.equal(isCodPayment(""), false);
  assert.equal(isCodPayment(null), false);
  assert.equal(isCodPayment(undefined), false);
});

test("paymentMethodLabel distinguishes COD, Wallet, and other methods", () => {
  assert.equal(paymentMethodLabel("Cod"), "COD");
  assert.equal(paymentMethodLabel("COD"), "COD");
  assert.equal(paymentMethodLabel("Wallet"), "Ví Nexus");
  assert.equal(paymentMethodLabel(null), "Ví Nexus");
  assert.equal(paymentMethodLabel("Stripe"), "Stripe");
});

test("canSellerAccept allows Paid, PendingConfirmation, and COD in PendingPayment", () => {
  assert.equal(canSellerAccept({ status: "PendingPayment", paymentMethod: "Cod" }), true);
  assert.equal(canSellerAccept({ status: "PENDING_PAYMENT", paymentMethod: "cod" }), true);
  assert.equal(canSellerAccept({ status: "PendingPayment", paymentMethod: "Wallet" }), false);
  assert.equal(canSellerAccept({ status: "PendingPayment", paymentMethod: null }), false);
  assert.equal(canSellerAccept({ status: "Paid", paymentMethod: "Wallet" }), true);
  assert.equal(canSellerAccept({ status: "PendingConfirmation", paymentMethod: "Wallet" }), true);
  assert.equal(canSellerAccept({ status: "Confirmed", paymentMethod: "Cod" }), false);
  assert.equal(canSellerAccept({ status: "Shipping", paymentMethod: "Cod" }), false);
  assert.equal(canSellerAccept({ status: "Cancelled", paymentMethod: "Cod" }), false);
});

test("describeSellerOrderStatus and sellerOrderStatusTone handle COD PendingPayment and SellerRejected", () => {
  assert.equal(describeSellerOrderStatus("PendingPayment", "Cod"), "Chờ bạn xác nhận (COD)");
  assert.equal(sellerOrderStatusTone("PendingPayment", "Cod"), "amber");

  assert.equal(describeSellerOrderStatus("PendingPayment", "Wallet"), "Chờ thanh toán");
  assert.equal(sellerOrderStatusTone("PendingPayment", "Wallet"), "sky");

  assert.equal(describeSellerOrderStatus("SellerRejected", "Cod"), "Đã từ chối");
  assert.equal(describeSellerOrderStatus("SellerRejected", "Wallet"), "Đã từ chối · Đã hoàn tiền cho người mua");
});
