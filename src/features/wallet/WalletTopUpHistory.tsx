"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPagination, Card, clickableRowProps, NoData, PageHeading } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { TopupBadge } from "./WalletTopUpFlow";
import { transactionDate } from "./WalletScreen";

export function WalletTopUpHistory() {
  const router = useRouter();
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
      setResumeError(cause instanceof Error ? cause.message : "Không tiếp tục được phiên thanh toán.");
      setResumingId(""); result.reload();
    }
  }
  return <>
    <PageHeading title="Lịch sử nạp tiền" description="Các lượt nạp đang chờ được hiển thị riêng với giao dịch ví đã ghi sổ." action={<Link className="button button-primary" href={ROUTES.buyer.topUp}>Nạp tiền</Link>} />
    {result.error && <ErrorState title="Không tải được lịch sử nạp" cause={result.error} onRetry={result.reload} />}
    {resumeError && <p className="notice" role="alert">{resumeError}</p>}
    {result.loading ? <TableSkeleton rows={5} cols={4} label="Đang tải lịch sử nạp…" /> : result.data?.items.length ? <Card><div className="table-scroll"><table className="data-table"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.data.items.map((item) => <tr key={item.transactionId} {...clickableRowProps(() => router.push(ROUTES.buyer.topUpDetail(item.transactionId)), "Nhấn để xem chi tiết giao dịch")}><td>{transactionDate(item.createdAt)}</td><td className="seller-money-amount">{formatMoney(item.amount)}</td><td><TopupBadge status={item.status} /></td><td>{item.canResume || item.status.toUpperCase() === "PENDING" ? <RowActionsMenu ariaLabel={`Thao tác giao dịch ${item.transactionId}`} primary={item.canResume ? { label: resumingId === item.transactionId ? "Đang kiểm tra…" : "Tiếp tục thanh toán", variant: "primary", disabled: Boolean(resumingId), onClick: () => void resume(item.transactionId) } : { label: "Kiểm tra lại", variant: "secondary", onClick: result.reload }} items={item.canResume && item.status.toUpperCase() === "PENDING" ? [{ label: "Kiểm tra lại", onClick: result.reload }] : []} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td></tr>)}</tbody></table></div></Card> : !result.error && <NoData title="Chưa có lượt nạp" />}
    {result.data?.pagination?.totalPages ? (
      <AdminPagination
        page={page}
        pageSize={result.data.pagination.pageSize}
        totalItems={result.data.pagination.totalCount}
        totalPages={result.data.pagination.totalPages}
        loading={result.loading}
        onPageChange={setPage}
        itemLabel="lượt nạp"
      />
    ) : (
      <div className="action-row"><button className="button button-secondary" type="button" disabled={page === 1 || result.loading} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button button-secondary" type="button" disabled={result.loading || !result.data?.pagination?.hasNextPage} onClick={() => setPage(page + 1)}>Trang sau</button></div>
    )}
  </>;
}
