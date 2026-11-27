import assert from "node:assert/strict";
import test from "node:test";
import { parseTransferAmount, toTransferRequest, validateTransfer } from "../src/features/wallet/transfer-rules.ts";

const ME = "11111111-2222-3333-4444-555555555555";
const OTHER = "aaaaaaaa-1111-1111-1111-111111111111";

test("the amount is whole dong within the back end limits", () => {
  assert.equal(parseTransferAmount("5.000"), 5000);
  assert.equal(parseTransferAmount(" 1,000 "), 1000);
  assert.equal(parseTransferAmount("12.5"), 125, "separators are removed, so a decimal point reads as thousands");
  assert.equal(parseTransferAmount("abc"), null);
  assert.equal(parseTransferAmount("-5"), null);
  assert.deepEqual(validateTransfer({ recipientUserId: OTHER, amount: "1000", note: "" }, ME), {});
  assert.ok(validateTransfer({ recipientUserId: OTHER, amount: "999", note: "" }, ME).amount);
  assert.ok(validateTransfer({ recipientUserId: OTHER, amount: "100000001", note: "" }, ME).amount);
  assert.deepEqual(validateTransfer({ recipientUserId: OTHER, amount: "100000000", note: "" }, ME), {});
});

test("the recipient must be a real id and not the sender", () => {
  assert.ok(validateTransfer({ recipientUserId: "nope", amount: "5000", note: "" }, ME).recipientUserId);
  assert.ok(validateTransfer({ recipientUserId: "00000000-0000-0000-0000-000000000000", amount: "5000", note: "" }, ME).recipientUserId);
  assert.match(validateTransfer({ recipientUserId: ME.toUpperCase(), amount: "5000", note: "" }, ME).recipientUserId, /chính bạn/);
});

test("the request carries a number and drops an empty note", () => {
  assert.deepEqual(toTransferRequest({ recipientUserId: ` ${OTHER} `, amount: "5.000", note: " " }), { recipientUserId: OTHER, amount: 5000, note: undefined });
});
