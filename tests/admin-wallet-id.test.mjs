import assert from "node:assert/strict";
import test from "node:test";
import { isWalletId } from "@/features/admin/wallet-id.ts";

test("accepts a standard 8-4-4-4-12 UUID, any case, with surrounding spaces", () => {
  assert.equal(isWalletId("3f2504e0-4f89-41d3-9a0c-0305e82c3301"), true);
  assert.equal(isWalletId("3F2504E0-4F89-41D3-9A0C-0305E82C3301"), true);
  assert.equal(isWalletId("  3f2504e0-4f89-41d3-9a0c-0305e82c3301  "), true);
});

test("rejects ids with a missing group, wrong length or non-hex characters", () => {
  assert.equal(isWalletId("3f2504e0-4f89-41d3-0305e82c3301"), false);
  assert.equal(isWalletId("3f2504e0-4f89-41d3-9a0c-0305e82c330"), false);
  assert.equal(isWalletId("3f2504e0-4f89-41d3-9a0c-0305e82c33zz"), false);
  assert.equal(isWalletId(""), false);
});
