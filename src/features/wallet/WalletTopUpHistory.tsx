"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { TopupBadge } from "./WalletTopUpFlow";
import { transactionDate } from "./WalletScreen";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { describeError, formatError } from "@/lib/errors/error-messages";

export function WalletTopUpHistory() {
  const [page, setPage] = useState(1);
  const [resumingId, setResumingId] = useState("");
  const [resumeError, setResumeError] = useState("");
  const result = useApiResource(`stripe-topups:${page}`, (signal) => walletService.topups(page, 10, signal));
  async function resume(id: string) {
    if (resumingId) return;
    setResumingId(id); setResumeError("");
    try {
      const response = await walletService.resumeTopup(id);
      if (new URL(response.paymentUrl).protocol !== "https:") throw new Error("Đường dẫn Stripe không hợp lệ.");
      window.location.assign(response.paymentUrl);
    } catch (cause) {
      setResumeError(formatError(describeError(cause, { operation: "write" })));
      setResumingId(""); result.reload();
    }
  }
  return <>
    <PageHeading title="Lịch sử nạp tiền" description="Các lượt nạp đang chờ được hiển thị riêng với giao dịch ví đã ghi sổ." action={<Link className="button button-primary" href={ROUTES.buyer.topUp}>Nạp tiền</Link>} />
    {result.error && <ErrorState cause={result.error} onRetry={result.reload} />}
    {resumeError && <p className="notice" role="alert">{resumeError}</p>}
    {result.loading ? <LoadingState label="Đang tải lịch sử nạp…" /> : result.data?.items.length ? <Card><div className="table-scroll"><table className="data-table"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.data.items.map((item) => <tr key={item.transactionId}><td>{transactionDate(item.createdAt)}</td><td className="seller-money-amount">{formatMoney(item.amount)}</td><td><TopupBadge status={item.status} /></td><td><div className="action-row wallet-history-actions"><Link className="button button-secondary" href={ROUTES.buyer.topUpDetail(item.transactionId)}>Chi tiết</Link>{item.status.toUpperCase() === "PENDING" && <button className="button button-secondary" type="button" onClick={result.reload}>Kiểm tra lại</button>}{item.canResume && <button className="button button-primary" type="button" disabled={Boolean(resumingId)} onClick={() => void resume(item.transactionId)}>{resumingId === item.transactionId ? "Đang kiểm tra…" : "Tiếp tục thanh toán"}</button>}</div></td></tr>)}</tbody></table></div></Card> : !result.error && <NoData title="Chưa có lượt nạp" />}
    <div className="action-row"><button className="button button-secondary" type="button" disabled={page === 1 || result.loading} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}{result.data?.pagination?.totalPages ? `/${result.data.pagination.totalPages}` : ""}</span><button className="button button-secondary" type="button" disabled={result.loading || !result.data?.pagination?.hasNextPage} onClick={() => setPage(page + 1)}>Trang sau</button></div>
  </>;
}
