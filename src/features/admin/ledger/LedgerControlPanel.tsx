"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Card } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeBackfill, describeShadowResult, shadowSwitchTarget } from "./ledger-control-rules";
import { ledgerService } from "./ledger.service";

/**
 * Admin only. The shadow ledger starts off. Switching sends the version the screen last read, so a change made by another admin is
 * refused instead of silently overwritten; the same switch twice changes nothing. Turning it off is also the emergency stop.
 */
export function LedgerControlPanel() {
  const status = useApiResource("ledger-control-status", (signal) => ledgerService.status(signal));
  const [confirm, setConfirm] = useState<"switch" | "backfill" | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const data = status.data;
  const target = shadowSwitchTarget(data);

  async function run() {
    if (!confirm || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      if (confirm === "switch") {
        if (!target) return;
        setNotice(describeShadowResult(await ledgerService.setShadow(target.enable, target.expectedVersion)));
      } else {
        setNotice(describeBackfill(await ledgerService.backfill()));
      }
      setConfirm(null);
      status.reload();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  }

  return <Card className="card-pad">
    <h2>Sổ cái bóng</h2>
    {status.error != null && <ErrorState cause={status.error} operation="read" onRetry={status.reload} />}
    {status.loading && !data ? <p>Đang tải…</p> : data && <>
      <p>{data.enabled ? "Đang bật: giao dịch mới được ghi thêm vào sổ bóng." : "Chưa bật: sổ bóng không ghi giao dịch mới."} Phiên bản {data.version ?? "?"}{data.shadowEpoch != null ? ` · kỳ ${data.shadowEpoch}` : ""}.</p>
      <p>Ví khớp: {data.matchedCount ?? 0} · lệch: {data.mismatchedCount ?? 0} · chưa kiểm: {data.uncheckedCount ?? 0}.</p>
      {notice && <p className="form-success" role="status">{notice}</p>}
      <div className="action-row">
        {target && <button type="button" className={"button " + (target.enable ? "button-primary" : "button-secondary")} onClick={() => { setFailure(null); setConfirm("switch"); }}>{target.enable ? "Bật sổ bóng" : "Tắt khẩn cấp"}</button>}
        <button type="button" className="button button-secondary" onClick={() => { setFailure(null); setConfirm("backfill"); }}>Ghi bù lịch sử cũ</button>
      </div>
    </>}
    <ConfirmDialog open={confirm !== null} title={confirm === "switch" ? (target?.enable ? "Bật sổ cái bóng?" : "Tắt sổ cái bóng?") : "Ghi bù lịch sử cũ?"} confirmLabel={confirm === "switch" ? (target?.enable ? "Bật" : "Tắt") : "Ghi bù"} busy={busy} error={failure} onConfirm={() => void run()} onClose={() => setConfirm(null)}>
      {confirm === "switch"
        ? <p>{target?.enable ? "Từ lúc bật, mọi giao dịch ví mới được ghi thêm vào sổ bóng. Số dư ví thật không thay đổi." : "Sổ bóng ngừng ghi giao dịch mới. Số dư ví thật không thay đổi."}</p>
        : <p>Chỉ ví có lịch sử liền mạch, chứng minh được, mới được ghi bù. Ví khác bị bỏ qua và được báo lại. Số dư ví thật không thay đổi.</p>}
    </ConfirmDialog>
  </Card>;
}
