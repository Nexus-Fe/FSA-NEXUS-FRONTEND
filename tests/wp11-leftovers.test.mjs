import test from "node:test";
import assert from "node:assert/strict";
import { asLedgerPage, exportFileName, ledgerQuery } from "@/features/seller/inventory-ledger.ts";
import { describeWarehouseRetry } from "@/features/staff/warehouse-retry-rules.ts";

test("inventory ledger: nested page, shared query, export name", () => {
  const page = asLedgerPage({ summary: { netChange: 5 }, items: { items: [{ id: "1" }], pagination: { totalPages: 2, hasNextPage: true } } });
  assert.equal(page.rows.length, 1);
  assert.equal(page.totalPages, 2);
  assert.equal(page.hasNextPage, true);
  assert.equal(asLedgerPage(null).rows.length, 0);
  assert.equal(ledgerQuery({ movementType: "INTAKE", search: " a " }, 2), "page=2&pageSize=20&movementType=INTAKE&search=a");
  assert.equal(ledgerQuery({ movementType: "INTAKE" }), "movementType=INTAKE");
  assert.equal(exportFileName("so_cai_kho_1.xlsx"), "so_cai_kho_1.xlsx");
  assert.equal(exportFileName(null), "so_cai_kho.xlsx");
});

test("warehouse retry messages", () => {
  assert.match(describeWarehouseRetry({ warehouseReady: true }), /sẵn sàng/);
  assert.match(describeWarehouseRetry({ warehouseReady: false }), /Chưa tạo được/);
});

import { canReportSubOrder, evidenceRequired, orderReportHref, parseReportPrefill } from "@/features/commerce/order-report.ts";

test("order report link and prefill", () => {
  const sub = { subOrderId: "11111111-1111-1111-1111-111111111111", sellerId: "22222222-2222-2222-2222-222222222222" };
  const href = orderReportHref(sub);
  const prefill = parseReportPrefill(new URL("http://x" + href).searchParams);
  assert.deepEqual(prefill, { referenceType: "Order", referenceId: sub.subOrderId, reportedUserId: sub.sellerId });
  assert.equal(parseReportPrefill(new URLSearchParams("referenceType=Order&referenceId=abc&reportedUserId=def")).referenceType, null);
  assert.equal(canReportSubOrder("Delivered"), true);
  assert.equal(canReportSubOrder("Shipped"), false);
  assert.equal(evidenceRequired("Order", "Fraud", 0), true);
  assert.equal(evidenceRequired("Order", "Spam", 0), false);
  assert.equal(evidenceRequired(null, "Fraud", 0), false);
});
