"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { sellerCatalogService } from "../services/catalog.service";
import { DEAD_STOCK_DAY_OPTIONS, asAlertList, parseThreshold, sortLowStock, type DeadStockAlert, type LowStockAlert } from "../inventory-alerts";

function ThresholdEditor({ alert, onSaved }: { alert: LowStockAlert; onSaved: () => void }) {
  const [text, setText] = useState(String(alert.minStockThreshold));
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  async function save() {
    const parsed = parseThreshold(text);
    if ("error" in parsed) { setProblem(parsed.error); return; }
    setProblem("");
    setBusy(true);
    setFailure(null);
    try {
      await sellerCatalogService.updateThreshold(alert.skuId, parsed.value);
      onSaved();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="action-row">
      <input className="field" inputMode="numeric" aria-label="Ngưỡng cảnh báo" aria-invalid={Boolean(problem)} disabled={busy} value={text} onChange={(event) => setText(event.target.value)} style={{ width: 90 }} />
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu ngưỡng"}</button>
      {problem && <small className="checkout-field-error" role="alert">{problem}</small>}
      {failure != null && <ErrorState cause={failure} operation="write" />}
    </div>
  );
}

/** Low stock and dead stock for the seller's warehouse, with the alert threshold editable per SKU. */
export function InventoryAlertsPanel() {
  const [days, setDays] = useState<number>(DEAD_STOCK_DAY_OPTIONS[0]);
  const [low, setLow] = useState<LowStockAlert[] | null>(null);
  const [dead, setDead] = useState<DeadStockAlert[] | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([sellerCatalogService.lowStockAlerts(undefined, controller.signal), sellerCatalogService.deadStockAlerts(days, undefined, controller.signal)])
      .then(([lowRaw, deadRaw]) => {
        if (!active) return;
        setFailure(null);
        setLow(sortLowStock(asAlertList<LowStockAlert>(lowRaw)));
        setDead(asAlertList<DeadStockAlert>(deadRaw));
      })
      .catch((cause) => { if (active && !controller.signal.aborted) setFailure(cause); });
    return () => { active = false; controller.abort(); };
  }, [days, reload]);

  return (
    <Card className="card-pad" style={{ marginBottom: 20 }}>
      <h2>Cảnh báo tồn kho</h2>
      {failure != null ? <ErrorState cause={failure} operation="read" onRetry={refresh} /> : low === null || dead === null ? <LoadingState /> : (
        <>
          <h3>Sắp hết hàng</h3>
          {low.length === 0 ? <p className="muted">Không có sản phẩm nào dưới ngưỡng cảnh báo.</p> : (
            <div className="table-scroll"><table className="data-table">
              <thead><tr><th>SKU</th><th>Còn bán được</th><th>Đang giữ</th><th>Ngưỡng</th></tr></thead>
              <tbody>{low.map((item) => (
                <tr key={`${item.skuId}:${item.warehouseId}`}>
                  <td>{item.skuId}</td><td>{item.availableQuantity}</td><td>{item.reservedQuantity}</td>
                  <td><ThresholdEditor alert={item} onSaved={refresh} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <h3 style={{ marginTop: 16 }}>Hàng tồn lâu không biến động</h3>
          <label className="field-wrap" style={{ maxWidth: 220 }}>Không biến động trong
            <select className="field" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {DEAD_STOCK_DAY_OPTIONS.map((option) => <option key={option} value={option}>{option} ngày</option>)}
            </select>
          </label>
          {dead.length === 0 ? <p className="muted">Không có hàng tồn lâu trong {days} ngày qua.</p> : (
            <div className="table-scroll"><table className="data-table">
              <thead><tr><th>SKU</th><th>Tồn</th><th>Số ngày không biến động</th></tr></thead>
              <tbody>{dead.map((item) => <tr key={`${item.skuId}:${item.warehouseId}`}><td>{item.skuId}</td><td>{item.totalQuantity}</td><td>{item.daysWithoutMovement}</td></tr>)}</tbody>
            </table></div>
          )}
        </>
      )}
    </Card>
  );
}
