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
