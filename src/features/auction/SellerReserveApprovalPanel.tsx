"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useApiResource } from "@/lib/api/use-api-resource";
import { declineConsequence, describeReserveAnswer, describeReserveApprovalFailure } from "./reserve-approval";
import { auctionService } from "./services/auction.service";

/** Shown to the seller when an ended auction's top bid may be under the reserve price: accept the sale or decline it. The server has the last word. */
export function SellerReserveApprovalPanel({ auctionId, deadline, onAnswered }: { auctionId: string; deadline?: string | null; onAnswered: () => void }) {
  const status = useApiResource("seller-reserve-status", (signal) => auctionService.sellerReserveStatus(signal));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDecline, setConfirmDecline] = useState(false);

  async function answer(accept: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = accept ? await auctionService.acceptBelowReserve(auctionId) : await auctionService.declineBelowReserve(auctionId);
      setMessage(describeReserveAnswer(accept, response));
      setConfirmDecline(false);
      status.reload();
      onAnswered();
    } catch (cause) {
      setError(describeReserveApprovalFailure(cause));
      status.reload();
      onAnswered();
    } finally {
      setBusy(false);
    }
  }

  return <Card className="card-pad">
    <h2>Giá cao nhất thấp hơn giá sàn</h2>
    <p>Nếu phiên kết thúc với giá thấp hơn giá sàn, bạn có 12 giờ kể từ khi phiên kết thúc để đồng ý bán hoặc từ chối. Quá hạn, hệ thống sẽ tự xử lý phiên.</p>
    {deadline && <p><strong>Hạn phản hồi: {new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(deadline))}</strong></p>}
    {status.data && <p className="status-note">Bạn đã từ chối {status.data.consecutiveDeclineCount} lần liên tiếp.{status.data.isReserveRestricted ? " Quyền đặt giá sàn đang bị khóa." : ""}</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <div className="action-row">
      <button type="button" className="button button-primary" disabled={busy} onClick={() => void answer(true)}>Đồng ý bán</button>
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => setConfirmDecline(true)}>Từ chối</button>
    </div>
    <ConfirmDialog open={confirmDecline} title="Từ chối bán dưới giá sàn?" confirmLabel="Xác nhận từ chối" cancelLabel="Quay lại" busy={busy} onConfirm={() => void answer(false)} onClose={() => setConfirmDecline(false)}>
      <p>{declineConsequence(status.data?.consecutiveDeclineCount)}</p>
    </ConfirmDialog>
  </Card>;
}
