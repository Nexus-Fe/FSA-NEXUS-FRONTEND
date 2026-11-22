import assert from "node:assert/strict";
import test from "node:test";
import { budgetUsagePercent, canApproveBudget, canCloseBudget, checkPlatformFee, toBudgetRequest, validateBudgetForm } from "../src/features/admin/finance/finance-rules.ts";

test("the platform fee must be a number from 0 to 100", () => {
  assert.deepEqual(checkPlatformFee("5"), { ok: true, percent: 5 });
  assert.deepEqual(checkPlatformFee(" 2,5 "), { ok: true, percent: 2.5 });
  assert.deepEqual(checkPlatformFee("0"), { ok: true, percent: 0 });
  assert.deepEqual(checkPlatformFee("100"), { ok: true, percent: 100 });
  for (const bad of ["", "abc", "-1", "100.1", "101", "5%", "1.23456"]) assert.equal(checkPlatformFee(bad).ok, false, bad);
});

const ok = { name: "Q4", totalLimit: "1.000.000", dailyLimit: "500000", perOrderCap: "50000", evidenceRef: "CK-123" };
test("a budget follows per-order <= daily <= total like the back end", () => {
  assert.deepEqual(validateBudgetForm(ok), {});
  assert.ok(validateBudgetForm({ ...ok, dailyLimit: "2000000" }).dailyLimit);
  assert.ok(validateBudgetForm({ ...ok, perOrderCap: "600000" }).perOrderCap);
  assert.ok(validateBudgetForm({ ...ok, totalLimit: "0" }).totalLimit);
  assert.ok(validateBudgetForm({ ...ok, name: " " }).name);
  assert.ok(validateBudgetForm({ ...ok, name: "x".repeat(151) }).name);
  assert.ok(validateBudgetForm({ ...ok, evidenceRef: "" }).evidenceRef);
  assert.ok(validateBudgetForm({ ...ok, evidenceRef: "x".repeat(501) }).evidenceRef);
});

test("the request carries whole numbers parsed from the typed text", () => {
  assert.deepEqual(toBudgetRequest(ok), { name: "Q4", totalLimit: 1000000, dailyLimit: 500000, perOrderCap: 50000, evidenceRef: "CK-123" });
});

test("approve is offered only on a pending budget the viewer did not create", () => {
  const row = { status: "PendingApproval", createdByAdminId: "AAAA-1" };
  assert.equal(canApproveBudget(row, "bbbb-2"), true);
  assert.equal(canApproveBudget(row, "aaaa-1"), false, "creator must not approve their own budget (case-insensitive)");
  assert.equal(canApproveBudget(row, null), false);
  assert.equal(canApproveBudget({ ...row, status: "Active" }, "bbbb-2"), false);
  assert.equal(canCloseBudget({ status: "Active", createdByAdminId: "x" }), true);
  assert.equal(canCloseBudget({ status: "PendingApproval", createdByAdminId: "x" }), false);
});

test("usage percent is clamped", () => {
  assert.equal(budgetUsagePercent(1000, 100, 150), 25);
  assert.equal(budgetUsagePercent(0, 5, 5), 0);
  assert.equal(budgetUsagePercent(100, 500, 0), 100);
});
