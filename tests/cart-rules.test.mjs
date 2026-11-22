import assert from "node:assert/strict";
import test from "node:test";
import { canContinueToCheckout, describeCartIssue, normalizeValidation } from "../src/features/commerce/cart-rules.ts";

test("every issue type the back end reports has its own Vietnamese sentence", () => {
  const base = { cartItemId: "c", skuId: "s" };
  assert.match(describeCartIssue({ ...base, issueType: "OUT_OF_STOCK" }, "Áo"), /hết hàng/);
  assert.match(describeCartIssue({ ...base, issueType: "INSUFFICIENT_STOCK", availableStock: 2, requestedQuantity: 5 }, "Áo"), /chỉ còn 2.*chọn 5/);
  assert.match(describeCartIssue({ ...base, issueType: "PRICE_CHANGED", oldPrice: 100000, newPrice: 120000 }, "Áo"), /đã đổi/);
  assert.match(describeCartIssue({ ...base, issueType: "PRODUCT_INACTIVE" }, "Áo"), /không bán/);
  assert.match(describeCartIssue({ ...base, issueType: "PRODUCT_NOT_FOUND" }, "Áo"), /không còn tồn tại/);
});

test("the back end's English message and unknown types never reach the buyer", () => {
  const text = describeCartIssue({ cartItemId: "c", skuId: "s", issueType: "SOMETHING_NEW", message: "Raw English message" }, "Áo");
  assert.doesNotMatch(text, /Raw English/);
});

test("the buyer continues only when the cart is valid", () => {
  assert.equal(canContinueToCheckout(null), false);
  assert.equal(canContinueToCheckout(normalizeValidation({ isValid: true, issues: [] })), true);
  assert.equal(canContinueToCheckout(normalizeValidation({ isValid: false, hasStockIssues: true, issues: [{}] })), false);
  assert.deepEqual(normalizeValidation(undefined), { isValid: false, hasPriceChanges: false, hasStockIssues: false, issues: [] });
});
