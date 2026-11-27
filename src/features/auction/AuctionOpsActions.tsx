"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataState, ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { auctionService } from "./services/auction.service";
import { normalizeAuctionStatus } from "./contract";
import { auctionOpsService, canInvalidateBid, checkOpsReason } from "./ops.service";

/**
 * Operations on ONE auction for admin and staff: approve/reject a pending auction, re-run the deposit reconciliation,
 * retry the Catalog and Commerce sync, and invalidate a fraudulent bid (reason required; only while the auction is running).
 */
export function AuctionOpsActions({ auctionId, status, onChanged }: { auctionId: string; status: string; onChanged: () => void }) {
  const bids = useApiResource(`ops-bids:${auctionId}`, (signal) => auctionService.bids(auctionId, 1, signal).then((response) => response.data));
  const [busy, setBusy] = useState<"reconcile" | "sync" | "approve" | "reject" | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectProblem, setRejectProblem] = useState("");
  const [reviewFailure, setReviewFailure] = useState<unknown>(null);
  const [target, setTarget] = useState<{ bidId: string; amount: number } | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");
  const [invalidating, setInvalidating] = useState(false);
  const [invalidateFailure, setInvalidateFailure] = useState<unknown>(null);
  const isPendingApproval = normalizeAuctionStatus(status) === "PENDING_APPROVAL";

  async function approve() {
    setBusy("approve");
    setReviewFailure(null);
    setFailure(null);
    setNotice("");
    try {
      await auctionOpsService.approveAuction(auctionId);
      setNotice("Đã duyệt phiên đấu giá. Phiên đã chuyển sang Sắp diễn ra và sẽ tự động chạy khi tới giờ bắt đầu.");
      setConfirmApprove(false);
      onChanged();
    } catch (cause) {
      setReviewFailure(cause);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    const issue = checkOpsReason(rejectReason);
    if (issue) { setRejectProblem(issue); return; }
    setRejectProblem("");
    setBusy("reject");
    setReviewFailure(null);
    setFailure(null);
    setNotice("");
    try {
      await auctionOpsService.rejectAuction(auctionId, rejectReason.trim());
      setNotice("Đã từ chối phiên đấu giá và mở khóa sản phẩm để người bán có thể tạo lại phiên khác.");
      setConfirmReject(false);
      setRejectReason("");
      onChanged();
    } catch (cause) {
      setReviewFailure(cause);
    } finally {
      setBusy(null);
    }
  }

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
      {isPendingApproval && (
        <div className="notice" role="status" style={{ marginBottom: 12 }}>
          <strong>Phiên đang chờ duyệt:</strong> Kiểm tra thông tin sản phẩm, giá khởi điểm, bước giá và thời gian trước khi phê duyệt.
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="button button-primary button-small" disabled={busy !== null} onClick={() => { setReviewFailure(null); setConfirmApprove(true); }}>
              Duyệt phiên
            </button>
            <button type="button" className="button auction-danger-button button-small" disabled={busy !== null} onClick={() => { setReviewFailure(null); setRejectProblem(""); setRejectReason(""); setConfirmReject(true); }}>
              Từ chối phiên
            </button>
          </div>
        </div>
      )}
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
      <ConfirmDialog open={confirmApprove} title="Duyệt phiên đấu giá này?" confirmLabel="Xác nhận duyệt" busy={busy === "approve"} error={reviewFailure} onConfirm={() => void approve()} onClose={() => setConfirmApprove(false)}>
        <p>Phiên sẽ chuyển sang trạng thái <strong>Sắp diễn ra</strong> và tự động mở đấu giá đúng giờ bắt đầu đã hẹn.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirmReject} title="Từ chối phiên đấu giá này?" confirmLabel="Xác nhận từ chối" busy={busy === "reject"} error={reviewFailure} onConfirm={() => void reject()} onClose={() => setConfirmReject(false)}>
        <p>Phiên sẽ bị hủy và sản phẩm sẽ được mở khóa ở Catalog để người bán chỉnh sửa hoặc tạo phiên mới.</p>
        <label>Lý do từ chối (bắt buộc)<textarea className="field" rows={3} value={rejectReason} disabled={busy === "reject"} aria-invalid={Boolean(rejectProblem)} onChange={(event) => setRejectReason(event.target.value)} /></label>
        {rejectProblem && <p className="form-error" role="alert">{rejectProblem}</p>}
      </ConfirmDialog>
      <ConfirmDialog open={target !== null} title="Hủy hiệu lực lượt đặt giá này?" confirmLabel="Hủy hiệu lực" busy={invalidating} error={invalidateFailure} onConfirm={() => void invalidate()} onClose={() => setTarget(null)}>
        <p>Lượt {target ? formatMoney(target.amount) : ""} sẽ bị loại và giá dẫn đầu được tính lại. Người đặt được thông báo. Chỉ làm khi lượt giá gian lận.</p>
        <label>Lý do (bắt buộc)<textarea className="field" rows={3} value={reason} disabled={invalidating} aria-invalid={Boolean(problem)} onChange={(event) => setReason(event.target.value)} /></label>
        {problem && <p className="form-error" role="alert">{problem}</p>}
      </ConfirmDialog>
    </Card>
  );
}
