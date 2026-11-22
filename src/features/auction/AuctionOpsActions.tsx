"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataState, ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { auctionService } from "./services/auction.service";
import { auctionOpsService, canInvalidateBid, checkOpsReason } from "./ops.service";

/**
 * Operations on ONE auction for admin and staff: re-run the deposit reconciliation, retry the Catalog and Commerce sync, and invalidate a
 * fraudulent bid (reason required; only while the auction is running; the leading price is recalculated by the back end).
 */
export function AuctionOpsActions({ auctionId, status, onChanged }: { auctionId: string; status: string; onChanged: () => void }) {
  const bids = useApiResource(`ops-bids:${auctionId}`, (signal) => auctionService.bids(auctionId, 1, signal).then((response) => response.data));
  const [busy, setBusy] = useState<"reconcile" | "sync" | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [target, setTarget] = useState<{ bidId: string; amount: number } | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [invalidating, setInvalidating] = useState(false);
  const [invalidateFailure, setInvalidateFailure] = useState<unknown>(null);

  async function reconcile() {
    setBusy("reconcile");
    setFailure(null);
    setNotice("");
    try {
      const result = await auctionOpsService.reconcileDeposits(auctionId);
      setNotice(`Đã đưa ${result.queuedDeposits} khoản cọc vào hàng xử lý lại; còn ${result.remainingPendingDeposits} khoản đang chờ.`);
      onChanged();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    setFailure(null);
    setNotice("");
    try {
      const result = await auctionOpsService.retrySync(auctionId);
      setNotice(`Đã thử đồng bộ lại. Gửi sang Commerce: ${result.pushedCommerceSettlement ? "có" : "không"}; mở khóa ở Catalog: ${result.pushedCatalogUnlock ? "có" : "không"}.`);
      onChanged();
    } catch (cause) {
      setFailure(cause);
    } finally {
      setBusy(null);
    }
  }

  async function invalidate() {
    if (!target) return;
    const issue = checkOpsReason(reason);
    if (issue) { setProblem(issue); return; }
    setProblem("");
    setInvalidating(true);
    setInvalidateFailure(null);
    try {
      const result = await auctionOpsService.invalidateBid(auctionId, target.bidId, reason.trim());
      setNotice(`Đã hủy hiệu lực lượt đặt giá. Giá hiện hành: ${result.newCurrentPriceAmount != null ? formatMoney(result.newCurrentPriceAmount) : "chưa có"}; còn ${result.newBidCount} lượt.`);
      setTarget(null);
      setReason("");
      bids.reload();
      onChanged();
    } catch (cause) {
      setInvalidateFailure(cause);
    } finally {
      setInvalidating(false);
    }
  }

  return (
    <Card className="card-pad">
      <h2>Thao tác vận hành</h2>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {failure != null && <ErrorState cause={failure} operation="write" />}
      <div className="action-row">
        <button type="button" className="button button-secondary button-small" disabled={busy !== null} onClick={() => void reconcile()}>{busy === "reconcile" ? "Đang đối soát…" : "Đối soát cọc"}</button>
        <button type="button" className="button button-secondary button-small" disabled={busy !== null} onClick={() => void sync()}>{busy === "sync" ? "Đang đồng bộ…" : "Đồng bộ lại"}</button>
      </div>
      <h3>Lượt đặt giá gần đây</h3>
      <DataState loading={bids.loading} error={bids.error} empty={!bids.data?.items.length} emptyTitle="Chưa có lượt đặt giá" onRetry={bids.reload}>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Người đặt</th><th>Giá</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {bids.data?.items.map((bid) => (
                <tr key={bid.bidId}>
                  <td>{bid.bidderDisplayName}</td>
                  <td className="tabular-nums">{formatMoney(bid.amount)}</td>
                  <td><Badge tone={bid.isInvalidated ? "red" : bid.isWinning ? "green" : "slate"}>{bid.isInvalidated ? "Không hợp lệ" : bid.isWinning ? "Dẫn đầu" : "Hợp lệ"}</Badge></td>
                  <td>{canInvalidateBid(status, bid) && <button type="button" className="button button-secondary button-small" onClick={() => { setInvalidateFailure(null); setProblem(""); setReason(""); setTarget({ bidId: bid.bidId, amount: bid.amount }); }}>Hủy hiệu lực</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      <ConfirmDialog open={target !== null} title="Hủy hiệu lực lượt đặt giá này?" confirmLabel="Hủy hiệu lực" busy={invalidating} error={invalidateFailure} onConfirm={() => void invalidate()} onClose={() => setTarget(null)}>
        <p>Lượt {target ? formatMoney(target.amount) : ""} sẽ bị loại và giá dẫn đầu được tính lại. Người đặt được thông báo. Chỉ làm khi lượt giá gian lận.</p>
        <label>Lý do (bắt buộc)<textarea className="field" rows={3} value={reason} disabled={invalidating} aria-invalid={Boolean(problem)} onChange={(event) => setReason(event.target.value)} /></label>
        {problem && <p className="form-error" role="alert">{problem}</p>}
      </ConfirmDialog>
    </Card>
  );
}
