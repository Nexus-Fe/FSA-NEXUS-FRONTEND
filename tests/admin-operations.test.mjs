import assert from "node:assert/strict";
import test from "node:test";
import { jsonDiff, safeAuditValue } from "@/features/admin/operations/operations-outcome.ts";
import { parseFeatureList } from "@/lib/features/feature-flags.ts";

test("feature keys ignore unknown values and whitespace", () => {
  assert.deepEqual(parseFeatureList(" audit, vouchers, unknown, audit "), ["audit", "vouchers"]);
  assert.deepEqual(parseFeatureList(""), []);
});

test("audit diff detects a changed field and masks sensitive names", () => {
  const rows = jsonDiff({ status: "Open", passwordHash: "old" }, { status: "Closed", passwordHash: "new" });
  assert.equal(rows.find((row) => row.key === "status")?.changed, true);
  assert.equal(safeAuditValue("passwordHash", "secret"), "Đã che");
  assert.equal(safeAuditValue("metadata", { bank: { accountNumber: "123456" } }), '{"bank":{"accountNumber":"Đã che"}}');
  assert.equal(jsonDiff('{"status":"Open"}', '{"status":"Closed"}')[0].changed, true);
});
