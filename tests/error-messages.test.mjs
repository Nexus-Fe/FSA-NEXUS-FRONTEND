import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_DICTIONARY, describeError, formatError, isUncertainStatus } from "../src/lib/errors/error-messages.ts";

const api = (status, errorCode, traceId) => ({ status, errorCode, traceId });

test("every code the plan names has a message", () => {
  const required = [
    "BIDDER_RESTRICTED", "DEPOSIT_REQUIRED", "ACCOUNT_BANNED", "ACCOUNT_NOT_VERIFIED", "ACCOUNT_LOCKED_TEMPORARY", "ACCOUNT_RESTRICTED",
    "VOUCHER_NO_LONGER_VALID", "VOUCHER_BUDGET_EXHAUSTED", "VOUCHER_EXPIRED", "SUBSIDY_UNAVAILABLE", "SELLER_WAREHOUSE_MISSING",
    "SELLER_WAREHOUSE_INCOMPLETE", "FULFILLMENT_UNAVAILABLE", "INSUFFICIENT_STOCK", "INSUFFICIENT_AVAILABLE_BALANCE", "QUOTE_EXPIRED",
    "AUCTION_FORCE_CANCEL_REQUIRED", "ROLE_NOT_ALLOWED", "FEATURE_DISABLED", "NOT_FOUND", "CONCURRENT_UPDATE", "BUY_NOW_NOT_AVAILABLE",
    "SUBSIDY_APPROVER_MUST_DIFFER", "LEDGER_SETTINGS_VERSION_CONFLICT", "PRICE_CHANGED",
    "SHIPPING_QUOTE_FAILED", "SHIPPING_CARRIER_NOT_CONFIGURED", "SHIPPING_CARRIER_UNAVAILABLE", "SHIPPING_CARRIER_TIMEOUT", "STOCK_CHECK_UNAVAILABLE",
  ];
  for (const code of required) {
    assert.ok(ERROR_DICTIONARY[code]?.message, `${code} has no message`);
  }
});

test("a known code gives its own text and keeps the code and trace id for support", () => {
  const d = describeError(api(409, "voucher_no_longer_valid", "t-1"));
  assert.match(d.message, /không còn áp dụng/);
  assert.equal(d.code, "VOUCHER_NO_LONGER_VALID");
  assert.equal(d.traceId, "t-1");
  assert.equal(d.kind, "definite");
});

test("the back end's own message is never returned", () => {
  const cause = { status: 400, errorCode: "SOMETHING_NEW", message: "System.NullReferenceException at Foo.Bar()" };
  const d = describeError(cause);
  assert.doesNotMatch(formatError(d), /NullReference|Foo\.Bar/);
  assert.equal(d.code, "SOMETHING_NEW");
});

test("QUOTE_EXPIRED while placing an order is an unknown outcome and never claims nothing was created", () => {
  const d = describeError(api(400, "QUOTE_EXPIRED"), { operation: "write", scope: "place-order" });
  assert.equal(d.kind, "unknown-outcome");
  assert.match(d.message, /Chưa xác định/);
  assert.doesNotMatch(formatError(d), /chưa (được )?tạo|chưa bị trừ/i);
});

test("QUOTE_EXPIRED outside placing an order is an ordinary expired quote", () => {
  const d = describeError(api(400, "QUOTE_EXPIRED"), { operation: "read" });
  assert.equal(d.kind, "definite");
  assert.match(d.message, /hết hạn/);
});

test("only the two codes that fail before the wallet charge say the wallet was not charged, and only when placing an order", () => {
  for (const code of ["INSUFFICIENT_STOCK", "FULFILLMENT_UNAVAILABLE"]) {
    const placing = describeError(api(code === "INSUFFICIENT_STOCK" ? 400 : 503, code), { operation: "write", scope: "place-order" });
    assert.match(placing.message, /ví của bạn chưa bị trừ tiền/i, code);
    const elsewhere = describeError(api(code === "INSUFFICIENT_STOCK" ? 400 : 503, code), { operation: "write" });
    assert.doesNotMatch(formatError(elsewhere), /chưa bị trừ tiền/i, code);
  }
});

test("order placement text never promises that no order record exists", () => {
  for (const code of ["INSUFFICIENT_STOCK", "FULFILLMENT_UNAVAILABLE", "QUOTE_EXPIRED"]) {
    const d = describeError(api(400, code), { operation: "write", scope: "place-order" });
    assert.doesNotMatch(formatError(d), /đơn (hàng )?chưa (được )?tạo/i, code);
  }
});

test("a write that ends with no status, a timeout or a 5xx without a code has an unknown outcome", () => {
  for (const cause of [new TypeError("fetch failed"), api(undefined), api(408), api(429), api(500), api(502), api(503)]) {
    const d = describeError(cause, { operation: "write" });
    assert.equal(d.kind, "unknown-outcome");
    assert.match(d.message, /Chưa xác định/);
    assert.doesNotMatch(formatError(d), /chưa bị trừ/i);
  }
});

test("a read that fails the same way is just unavailable, never an unknown outcome", () => {
  const d = describeError(new TypeError("fetch failed"), { operation: "read" });
  assert.equal(d.kind, "unavailable");
});

test("a definite refusal without a known code gets the general message with the code kept", () => {
  const d = describeError(api(400, undefined), { operation: "write" });
  assert.equal(d.kind, "definite");
  assert.match(d.message, /không thực hiện được/);
});

test("401, 403 and 404 without a code map to session, permission and not found", () => {
  assert.equal(describeError(api(401)).kind, "permission");
  assert.match(describeError(api(401)).message, /hết hạn/);
  assert.equal(describeError(api(403)).kind, "permission");
  assert.equal(describeError(api(404)).kind, "definite");
});

test("uncertain statuses are exactly: none, 408, 429 and 5xx", () => {
  assert.equal(isUncertainStatus(undefined), true);
  assert.equal(isUncertainStatus(408), true);
  assert.equal(isUncertainStatus(429), true);
  assert.equal(isUncertainStatus(500), true);
  assert.equal(isUncertainStatus(400), false);
  assert.equal(isUncertainStatus(409), false);
  assert.equal(isUncertainStatus(422), false);
});

test("a non-error value is handled without throwing", () => {
  assert.doesNotThrow(() => describeError(null, { operation: "write" }));
  assert.doesNotThrow(() => describeError("boom"));
  assert.equal(describeError(undefined, { operation: "write" }).kind, "unknown-outcome");
});
