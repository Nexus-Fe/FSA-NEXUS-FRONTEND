"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPagination, Card, clickableRowProps, NoData, PageHeading } from "@/components/ui/Primitives";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { ErrorState } from "@/components/ui/States";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "./services/wallet.service";
import { TopupBadge } from "./WalletTopUpFlow";
import { transactionDate } from "./WalletScreen";
import { describeError, formatError } from "@/lib/errors/error-messages";

export function WalletTopUpHistory() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [resumingId, setResumingId] = useState("");
  const [resumeError, setResumeError] = useState("");
  const result = useApiResource(`stripe-topups:${page}:${statusFilter}`, (signal) => walletService.topups(page, 10, signal, statusFilter || undefined));
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
    <PageHeading
      title="Lịch sử nạp tiền"
      description="Các lượt nạp đang chờ được hiển thị riêng với giao dịch ví đã ghi sổ."
      action={
        <div className="action-row">
          <Link className="button button-secondary button-small" href={ROUTES.buyer.wallet}>Quay lại ví</Link>
          <Link className="button button-primary button-small" href={ROUTES.buyer.topUp}>Nạp tiền</Link>
        </div>
      }
    />
    <FluidChoiceBar
      mode="filter"
      ariaLabel="Lọc lịch sử nạp theo trạng thái"
      options={[
        { value: "", label: "Tất cả" },
        { value: "Success", label: "Thành công" },
        { value: "Pending", label: "Đang xác nhận" },
        { value: "Expired", label: "Hết hạn" },
        { value: "Failed", label: "Thất bại" },
      ]}
      value={statusFilter}
      onChange={(next) => { setStatusFilter(next); setPage(1); }}
    />
    {result.error && <ErrorState title="Không tải được lịch sử nạp" cause={result.error} onRetry={result.reload} />}
    {resumeError && <p className="notice" role="alert">{resumeError}</p>}
    {result.loading ? <TableSkeleton rows={5} cols={4} label="Đang tải lịch sử nạp…" /> : result.data?.items.length ? <Card><div className="table-scroll"><table className="data-table"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.data.items.map((item) => <tr key={item.transactionId} {...clickableRowProps(() => router.push(ROUTES.buyer.topUpDetail(item.transactionId)), "Nhấn để xem chi tiết giao dịch")}><td>{transactionDate(item.createdAt)}</td><td className="seller-money-amount">{formatMoney(item.amount)}</td><td><TopupBadge status={item.status} /></td><td>{item.canResume || item.status.toUpperCase() === "PENDING" ? <RowActionsMenu ariaLabel={`Thao tác giao dịch ${item.transactionId}`} primary={item.canResume ? { label: resumingId === item.transactionId ? "Đang kiểm tra…" : "Tiếp tục thanh toán", variant: "primary", disabled: Boolean(resumingId), onClick: () => void resume(item.transactionId) } : { label: "Kiểm tra lại", variant: "secondary", onClick: result.reload }} items={item.canResume && item.status.toUpperCase() === "PENDING" ? [{ label: "Kiểm tra lại", onClick: result.reload }] : []} /> : <span style={{ color: "var(--muted)" }}>—</span>}</td></tr>)}</tbody></table></div>{result.data?.items.length ? (
      <AdminPagination
        page={page}
        pageSize={result.data.pagination?.pageSize ?? 20}
        totalItems={result.data.pagination?.totalCount}
        totalPages={result.data.pagination?.totalPages ?? (result.data.pagination?.hasNextPage ? page + 1 : page)}
        loading={result.loading}
        onPageChange={setPage}
        itemLabel="lượt nạp"
      />
    ) : null}</Card> : !result.error && <NoData title="Chưa có lượt nạp" />}
  </>;
}
