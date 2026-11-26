import assert from "node:assert/strict";
import test from "node:test";
import {
  describePlaceOrderFailure, describeQuoteFailure, describeCartFailure,
  readUnknownOrderMarker, writeUnknownOrderMarker, clearUnknownOrderMarker,
} from "../src/features/commerce/checkout-outcome.ts";
import { describeRejectedVoucher, ineligibleText, validateVoucherForm } from "../src/features/coupons/voucher-outcome.ts";
import { canSelectVoucher } from "../src/features/coupons/voucher-rules.ts";

const api = (status, errorCode) => ({ status, errorCode });

test("a lost answer when placing an order locks ordering and asks the buyer to check, never to retry", () => {
  for (const cause of [new TypeError("fetch failed"), api(undefined), api(408), api(502), api(400, "QUOTE_EXPIRED")]) {
    const f = describePlaceOrderFailure(cause);
    assert.equal(f.unknownOutcome, true);
    assert.equal(f.needsNewQuote, false, "must not invite a new quote while the result is unknown");
    assert.match(f.message, /Chưa xác định/);
    assert.doesNotMatch(f.message, /chưa bị trừ|chưa được tạo/i);
  }
});

test("a refusal with a code is definite and needs a new quote", () => {
  const stock = describePlaceOrderFailure(api(400, "INSUFFICIENT_STOCK"));
  assert.equal(stock.unknownOutcome, false);
  assert.equal(stock.needsNewQuote, true);
  assert.match(stock.message, /ví của bạn chưa bị trừ tiền/i);
  assert.equal(describePlaceOrderFailure(api(409, "VOUCHER_NO_LONGER_VALID")).unknownOutcome, false);

  const shipMismatch = describePlaceOrderFailure(api(409, "SHIPPING_FEE_MISMATCH"));
  assert.equal(shipMismatch.unknownOutcome, false);
  assert.equal(shipMismatch.needsNewQuote, true);
  assert.equal(shipMismatch.reloadCart, false);
  assert.match(shipMismatch.message, /Phí vận chuyển đã thay đổi/i);
});

test("a price increase reloads the cart so the buyer sees the new prices", () => {
  const f = describePlaceOrderFailure(api(409, "PRICE_CHANGED"));
  assert.equal(f.reloadCart, true);
  assert.equal(f.unknownOutcome, false);
});

test("a quote failure is safe to retry and never talks about money taken", () => {
  const f = describeQuoteFailure(new TypeError("fetch failed"));
  assert.doesNotMatch(f.message, /trừ tiền/i);
  assert.match(describeQuoteFailure(api(422, "SELLER_WAREHOUSE_MISSING")).message, /chưa có kho/);
  assert.match(describeQuoteFailure(api(422, "SELLER_WAREHOUSE_INCOMPLETE")).message, /quận, phường/);
});

test("cart failures use the dictionary and never the raw message", () => {
  const m = describeCartFailure({ status: 400, errorCode: "INSUFFICIENT_STOCK", message: "Boom NullReference" });
  assert.doesNotMatch(m, /NullReference/);
  assert.match(m, /Không đủ hàng/);
});

test("the unknown-result lock survives a page reload through session storage and is read back", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.equal(readUnknownOrderMarker(storage), null);
  writeUnknownOrderMarker(storage, 1234);
  assert.deepEqual(readUnknownOrderMarker(storage), { at: 1234 });
  clearUnknownOrderMarker(storage);
  assert.equal(readUnknownOrderMarker(storage), null);
  assert.equal(readUnknownOrderMarker(undefined), null);
  store.set("nexus_checkout_unknown_outcome", "not json");
  assert.equal(readUnknownOrderMarker(storage), null);
});

test("every rejection reason the quote can return has a Vietnamese label", () => {
  for (const code of ["NOT_FOUND", "NOT_ACTIVE", "NOT_STARTED", "EXPIRED", "USAGE_LIMIT_REACHED", "USER_LIMIT_REACHED", "MIN_ORDER_NOT_MET", "SCOPE_MISMATCH", "EVALUATION_FAILED"]) {
    assert.doesNotMatch(describeRejectedVoucher(code), /^Mã không áp dụng được cho giỏ hàng này\.$/, code);
  }
  assert.match(describeRejectedVoucher("SOMETHING_NEW"), /không áp dụng được/);
});

test("the English ineligibleReason from the back end is translated, never shown as is", () => {
  assert.match(ineligibleText("Minimum order amount not met."), /tối thiểu/);
  assert.doesNotMatch(ineligibleText("Some new English reason."), /English|reason/i);
  assert.match(ineligibleText(null), /Chưa đủ điều kiện/);
});

test("voucher selection follows the back end rules: one system voucher, one voucher per shop", () => {
  const sys = { code: "SYS1", scopeType: "System" };
  const sys2 = { code: "SYS2", scopeType: "System" };
  const shopA = { code: "A1", scopeType: "Shop", ownerSellerId: "a" };
  const shopA2 = { code: "A2", scopeType: "Product", ownerSellerId: "a" };
  const shopB = { code: "B1", scopeType: "Shop", ownerSellerId: "b" };
  assert.equal(canSelectVoucher([sys], sys2) !== null, true);
  assert.equal(canSelectVoucher([sys], shopA), null);
  assert.equal(canSelectVoucher([shopA], shopA2) !== null, true);
  assert.equal(canSelectVoucher([shopA], shopB), null);
  assert.equal(canSelectVoucher([shopA], shopA), null);
});

test("the create form is checked before it is sent", () => {
  const ok = { code: "X", name: "N", discountType: "Percentage", discountValue: 10, maxUsesPerUser: 1 };
  assert.equal(validateVoucherForm(ok), null);
  assert.ok(validateVoucherForm({ ...ok, discountValue: 101 }));
  assert.ok(validateVoucherForm({ ...ok, discountValue: 0 }));
  assert.ok(validateVoucherForm({ ...ok, maxUsesPerUser: 0 }));
  assert.ok(validateVoucherForm({ ...ok, startsAt: "2026-02-01", endsAt: "2026-01-01" }));
  assert.ok(validateVoucherForm({ ...ok, code: " " }));
});
