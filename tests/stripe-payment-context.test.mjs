import assert from "node:assert/strict";
import test from "node:test";
import {
  clearStripePaymentContext,
  clearTopupDraft,
  getTopupIdempotencyKey,
  readStripePaymentContext,
  saveStripePaymentContext,
} from "../src/features/wallet/stripe-payment-context.ts";

function useTab() {
  const values = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  };
  return values;
}

test("a retry in the same tab reuses the key for its amount", () => {
  useTab();
  const first = getTopupIdempotencyKey(100000);
  assert.equal(getTopupIdempotencyKey(100000), first);
  const second = getTopupIdempotencyKey(200000);
  assert.notEqual(second, first);
  clearTopupDraft();
  assert.notEqual(getTopupIdempotencyKey(200000), second);
});

test("the result resolves a stored top-up and supports the previous key", () => {
  const values = useTab();
  values.set("nexus:stripe-topup-id", "old-transaction");
  assert.deepEqual(readStripePaymentContext(), { kind: "topup", transactionId: "old-transaction" });
  saveStripePaymentContext({ kind: "topup", transactionId: "new-transaction" });
  assert.deepEqual(readStripePaymentContext(), { kind: "topup", transactionId: "new-transaction" });
  assert.equal(values.has("nexus:stripe-topup-id"), false);
  clearStripePaymentContext();
  assert.equal(readStripePaymentContext(), null);
});
