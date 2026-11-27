import assert from "node:assert/strict";
import test from "node:test";
import { describeError } from "../src/lib/errors/error-messages.ts";

const api = (status, errorCode) => ({ status, errorCode });

test("an unavailable address source keeps the address and is not blamed on the user", () => {
  const d = describeError(api(503, "LOCATION_SOURCE_UNAVAILABLE"), { operation: "read" });
  assert.equal(d.code, "LOCATION_SOURCE_UNAVAILABLE");
  assert.equal(d.kind, "unavailable");
  assert.match(d.hint ?? "", /vẫn được giữ nguyên/i);
});

test("a carrier failure at checkout is not blamed on the buyer's address", () => {
  for (const code of ["SHIPPING_CARRIER_NOT_CONFIGURED", "SHIPPING_CARRIER_UNAVAILABLE", "SHIPPING_CARRIER_TIMEOUT"]) {
    const d = describeError(api(503, code), { operation: "read" });
    assert.equal(d.code, code);
    assert.equal(d.kind, "unavailable");
    assert.doesNotMatch(d.message, /địa chỉ không hợp lệ/i);
  }
  assert.match(describeError(api(503, "SHIPPING_CARRIER_NOT_CONFIGURED")).hint ?? "", /không phải lỗi địa chỉ/i);
});

test("an address the carrier cannot price keeps its own message and points at the address", () => {
  const d = describeError(api(400, "SHIPPING_QUOTE_FAILED"));
  assert.match(d.message, /phí vận chuyển/);
  assert.match(d.hint ?? "", /địa chỉ giao hàng/);
});

test("an unreachable stock check says the order could not be placed", () => {
  const d = describeError(api(503, "STOCK_CHECK_UNAVAILABLE"), { operation: "write" });
  assert.match(d.message, /tồn kho/);
});
