import assert from "node:assert/strict";
import test from "node:test";
import { maskAccountNumber, sortBankAccounts, toBankAccountRequest, validateBankAccount } from "../src/features/wallet/bank-accounts.ts";

const ok = { bankName: "Vietcombank", accountNumber: "0123 4567 89", accountHolderName: "NGUYEN VAN A", isDefault: false };

test("a bank account follows the back end limits", () => {
  assert.deepEqual(validateBankAccount(ok), {});
  assert.ok(validateBankAccount({ ...ok, bankName: "V" }).bankName);
  assert.ok(validateBankAccount({ ...ok, bankName: "x".repeat(151) }).bankName);
  assert.ok(validateBankAccount({ ...ok, accountNumber: "123" }).accountNumber);
  assert.ok(validateBankAccount({ ...ok, accountNumber: "12-34-56" }).accountNumber);
  assert.ok(validateBankAccount({ ...ok, accountHolderName: "A" }).accountHolderName);
  assert.ok(validateBankAccount({ ...ok, accountHolderName: "x".repeat(256) }).accountHolderName);
});

test("spaces are removed from the number before sending", () => {
  assert.equal(toBankAccountRequest(ok).accountNumber, "0123456789");
});

test("the account is shown masked and the default is listed first", () => {
  assert.equal(maskAccountNumber("0123456789"), "••••••6789");
  assert.equal(maskAccountNumber("1234"), "1234");
  assert.deepEqual(sortBankAccounts([{ id: "a", isDefault: false }, { id: "b", isDefault: true }]).map((x) => x.id), ["b", "a"]);
});
