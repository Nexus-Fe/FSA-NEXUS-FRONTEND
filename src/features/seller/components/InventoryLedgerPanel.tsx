"use client";

import { useState } from "react";
import { AdminPagination, Card, NoData } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { api, fetchBlob, unwrap } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { asLedgerPage, exportFileName, ledgerQuery, movementLabel, type LedgerFilter } from "../inventory-ledger";

const when = (value: string) => new Date(value).toLocaleString("vi-VN");
const MOVEMENTS = ["INTAKE", "ADJUST", "RESERVE", "RELEASE", "COMMIT", "RETURN"] as const;

/** The seller's stock movement book with filters, totals and a spreadsheet export of exactly what the filters select. */
export function InventoryLedgerPanel() {
  const [filter, setFilter] = useState<LedgerFilter>({});
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportFailure, setExportFailure] = useState<unknown>(null);
  const ledger = useApiResource(`inventory-ledger:${page}:${JSON.stringify(filter)}`, async (signal) => asLedgerPage(unwrap(await api.get<unknown>(`/api/v1/inventories/ledgers?${ledgerQuery(filter, page)}`, { signal }))));
  const data = ledger.data;

  function change(next: LedgerFilter) { setFilter(next); setPage(1); }

  async function exportFile() {
    if (exporting) return;
    setExporting(true);
    setExportFailure(null);
    try {
      const { blob, fileName } = await fetchBlob(`/api/v1/inventories/ledgers/export?${ledgerQuery(filter)}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportFailure(cause);
    } finally {
      setExporting(false);
    }
  }

  return <Card className="card-pad" style={{ marginBottom: 20 }}>
    <h2>Sổ kho</h2>
    <div className="ops-filters">
      <label>Loại biến động<select className="field" value={filter.movementType ?? ""} onChange={(event) => change({ ...filter, movementType: event.target.value || undefined })}><option value="">Tất cả</option>{MOVEMENTS.map((item) => <option key={item} value={item}>{movementLabel(item)}</option>)}</select></label>
      <label>Từ ngày<input className="field" type="date" value={filter.fromDate ?? ""} onChange={(event) => change({ ...filter, fromDate: event.target.value || undefined })} /></label>
      <label>Đến ngày<input className="field" type="date" value={filter.toDate ?? ""} onChange={(event) => change({ ...filter, toDate: event.target.value || undefined })} /></label>
      <label>Tìm kiếm<input className="field" value={filter.search ?? ""} onChange={(event) => change({ ...filter, search: event.target.value || undefined })} /></label>
    </div>
    <div className="action-row"><button type="button" className="button button-secondary" disabled={exporting} onClick={() => void exportFile()}>{exporting ? "Đang xuất…" : "Xuất Excel"}</button></div>
    {exportFailure != null && <ErrorState cause={exportFailure} operation="read" />}
    {ledger.error != null && <ErrorState cause={ledger.error} operation="read" onRetry={ledger.reload} />}
    {ledger.loading && !data ? <p>Đang tải…</p> : data && <>
      {data.summary && <p>Nhập {data.summary.totalInboundQuantity} · Xuất {data.summary.totalOutboundQuantity} · Chênh lệch {data.summary.netChange} · {data.summary.totalTransactions} giao dịch.</p>}
      {data.rows.length ? <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Thời điểm</th><th>Loại</th><th>Số lượng</th><th>SKU</th><th>Kho</th><th>Ghi chú</th></tr></thead>
        <tbody>{data.rows.map((row) => <tr key={row.id}><td>{when(row.createdAt)}</td><td>{movementLabel(row.movementType)}</td><td>{row.quantity}</td><td className="mono">{row.skuId}</td><td>{row.warehouseName ?? "—"}</td><td>{row.note ?? "—"}</td></tr>)}</tbody>
      </table></div> : <NoData title="Không có biến động phù hợp." />}
      {data.totalPages > 1 && (
        <AdminPagination
          page={page}
          totalPages={data.totalPages}
          loading={ledger.loading}
          onPageChange={setPage}
          itemLabel="giao dịch"
        />
      )}
    </>}
  </Card>;
}
