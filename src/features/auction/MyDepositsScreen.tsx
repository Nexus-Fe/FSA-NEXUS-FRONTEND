"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { formatMoney } from "@/lib/presentation";
import { depositStatusLabel } from "./auction-outcome";
import { auctionService } from "./services/auction.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
const when = (value: string | null) => (value ? DATE.format(new Date(value)) : "—");
const FILTERS = [["", "Tất cả"], ["Authorized", "Đang giữ"], ["Captured", "Đã tính vào đơn"], ["Released", "Đã hoàn lại"], ["Failed", "Chưa giữ được"]] as const;

/** The deposits the buyer has put on auctions, with their state. View only. */
export function MyDepositsScreen() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const deposits = useApiResource(`my-deposits:${page}:${status}`, (signal) => auctionService.myDeposits(page, status, signal));
  return <div className="auction-surface">
    <PageHeading title="Cọc của tôi" description="Khoản cọc giữ trong Ví Nexus cho từng phiên đấu giá. Màn này chỉ để xem." />
    <FluidChoiceBar mode="filter" ariaLabel="Lọc theo trạng thái cọc" options={FILTERS.map(([value, label]) => ({ value, label }))} value={status} onChange={(next) => { setStatus(next); setPage(1); }} />
    {deposits.error && <p className="notice" role="alert">{formatError(describeError(deposits.error, { operation: "read" }))} <button type="button" className="button button-secondary" onClick={deposits.reload}>Thử lại</button></p>}
    {deposits.loading && !deposits.data ? <TableSkeleton rows={5} cols={4} label="Đang tải danh sách cọc…" /> : deposits.data?.items.length ? <Card>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Phiên</th><th>Số tiền</th><th>Tỷ lệ</th><th>Trạng thái</th><th>Mục đích trừ cọc</th><th>Mốc thời gian</th></tr></thead><tbody>
        {deposits.data.items.map((item) => <tr key={item.depositId}>
          <td><Link href={ROUTES.auction.room(item.auctionId)}>{item.auctionTitle || item.auctionId}</Link></td>
          <td>{formatMoney(item.amount)}</td>
          <td>{item.ratePercent}%</td>
          <td><Badge tone="slate">{depositStatusLabel(item.status)}</Badge></td>
          <td>{item.capturePurpose ?? "—"}</td>
          <td><small>Giữ: {when(item.authorizedAt)}<br />Hoàn: {when(item.releasedAt)}<br />Trừ: {when(item.capturedAt)}</small></td>
        </tr>)}
      </tbody></table></div>
    </Card> : !deposits.error && <NoData title="Bạn chưa có khoản cọc nào." />}
    {deposits.data && deposits.data.pagination.totalPages > 1 && (
      <AdminPagination
        page={deposits.data.pagination.pageIndex}
        pageSize={deposits.data.pagination.pageSize}
        totalItems={deposits.data.pagination.totalCount}
        totalPages={deposits.data.pagination.totalPages}
        loading={deposits.loading}
        onPageChange={setPage}
        itemLabel="khoản cọc"
      />
    )}
  </div>;
}
