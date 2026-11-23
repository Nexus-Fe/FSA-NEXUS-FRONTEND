"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { Card, NoData } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { useApiResource } from "@/lib/api/use-api-resource";
import { accountService } from "./account.service";
import { reputationReasonLabel, signedPoints } from "./account-rules";

const when = (value: string) => new Date(value).toLocaleString("vi-VN");

/** What moves the score and the limits to bid or sell, from the platform policy. Shown as read-only facts. */
export function ReputationPolicyBlock() {
  const policy = useApiResource("reputation-policy", (signal) => accountService.reputationPolicy(signal));
  const data = policy.data;
  return <Card className="card-pad">
    <h2>Quy định điểm uy tín</h2>
    {policy.error != null && <ErrorState cause={policy.error} operation="read" onRetry={policy.reload} />}
    {policy.loading && !data ? <p>Đang tải…</p> : data && <>
      <div className="info-row"><span>Điểm khi mới đăng ký</span><strong>{data.initialScore}</strong></div>
      <div className="info-row"><span>Thang điểm</span><strong>{data.minScore} – {data.maxScore}</strong></div>
      <div className="info-row"><span>Điểm tối thiểu để đặt giá đấu giá</span><strong>{data.minScoreToBid}</strong></div>
      <div className="info-row"><span>Điểm tối thiểu để bán hàng</span><strong>{data.minScoreToSell}</strong></div>
      <div className="info-row"><span>Hoàn tất đơn hàng</span><strong>{signedPoints(data.orderCompletedReward)}</strong></div>
      <div className="info-row"><span>Quá hạn thanh toán</span><strong>{signedPoints(-Math.abs(data.paymentTimeoutPenalty))}</strong></div>
      <div className="info-row"><span>Người bán huỷ đơn</span><strong>{signedPoints(-Math.abs(data.sellerCancelPenalty))}</strong></div>
      <p className="status-note">{data.enforcementEnabled ? "Giới hạn điểm đang được áp dụng." : "Giới hạn điểm hiện chưa được áp dụng."}</p>
    </>}
  </Card>;
}

/** The signed-in user's own score changes, newest first. */
export function ReputationHistoryBlock() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [page, setPage] = useState(1);
  const history = useApiResource(userId ? `reputation-history:${userId}:${page}` : null, (signal) => accountService.reputationHistory(userId ?? "", page, signal));
  const rows = history.data ?? [];
  return <Card className="card-pad">
    <h2>Lịch sử thay đổi điểm</h2>
    {history.error != null && <ErrorState cause={history.error} operation="read" onRetry={history.reload} />}
    {history.loading && !history.data ? <p>Đang tải…</p> : rows.length ? <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Thời điểm</th><th>Vai trò</th><th>Thay đổi</th><th>Điểm sau</th><th>Lý do</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.logId}>
        <td>{when(row.createdAt)}</td><td>{row.targetRole}</td><td><strong>{signedPoints(row.changeAmount)}</strong></td><td>{row.scoreAfter}</td>
        <td>{reputationReasonLabel(row.reason)}{row.note && <><br /><small>{row.note}</small></>}</td>
      </tr>)}</tbody>
    </table></div> : !history.error && <NoData title="Chưa có thay đổi điểm nào." />}
    {(page > 1 || rows.length === 20) && <div className="action-row">
      <button type="button" className="button button-secondary" disabled={page <= 1 || history.loading} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {page}</span>
      <button type="button" className="button button-secondary" disabled={rows.length < 20 || history.loading} onClick={() => setPage(page + 1)}>Trang sau</button>
    </div>}
  </Card>;
}
