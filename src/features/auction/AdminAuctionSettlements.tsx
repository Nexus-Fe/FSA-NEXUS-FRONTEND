"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPagination, Badge, Card, clickableRowProps, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { AUCTION_SETTLEMENT_STATUS, statusLabel } from "@/lib/status-labels";
import { auctionService } from "./services/auction.service";

function settlementTone(status?: string): "green" | "amber" | "red" | "slate" {
  const s = (status ?? "").toUpperCase();
  if (s === "PAID") return "green";
  if (s === "PENDINGPAYMENT" || s === "AWAITINGSELLERAPPROVAL") return "amber";
  if (s === "FAILED" || s === "EXPIRED" || s === "CANCELLED") return "red";
  return "slate";
}

export function AdminAuctionSettlements() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [determinedFrom, setDeterminedFrom] = useState("");
  const settlements = useApiResource(`admin-auction-settlements:${page}:${status}:${determinedFrom}`, (signal) => auctionService.settlements(page, status, determinedFrom, signal));
  return <div className="auction-surface">
    <PageHeading title="Quyết toán đấu giá" description="Theo dõi người thắng, đơn hàng và tiến trình thanh toán của các phiên đã chốt." />
    <div className="auction-settlement-filters"><label className="field-wrap auction-settlement-filter">Trạng thái quyết toán<select className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả</option><option value="PendingPayment">Chờ thanh toán</option><option value="AwaitingSellerApproval">Chờ người bán duyệt</option><option value="Paid">Đã thanh toán</option><option value="Failed">Không thành công</option><option value="Expired">Hết hạn</option><option value="Cancelled">Đã hủy</option></select></label><label className="field-wrap auction-settlement-filter">Chốt từ ngày<input className="field" type="date" value={determinedFrom} onChange={(event) => { setDeterminedFrom(event.target.value); setPage(1); }} /></label></div>
    {settlements.error && <div role="alert" className="notice">{settlements.error.message} <button type="button" className="button button-secondary button-small" onClick={settlements.reload}>Tải lại</button></div>}
    {settlements.loading && !settlements.data ? <NoData title="Đang tải quyết toán…" /> : settlements.data?.items.length ? <Card><div className="table-scroll"><table className="data-table auction-operations-table"><thead><tr><th>Phiên</th><th>Giá chốt</th><th>Trạng thái</th><th>Đơn hàng</th></tr></thead><tbody>{settlements.data.items.map((item) => { const detailHref = ROUTES.admin.auction(item.auctionId); return <tr key={item.auctionId} {...clickableRowProps(() => router.push(detailHref), "Nhấn để xem chi tiết quyết toán")}><td><Link href={detailHref}><strong>{item.productTitle}</strong></Link></td><td>{formatMoney(item.finalPriceAmount)}</td><td><Badge tone={settlementTone(item.settlementStatus)}>{statusLabel(AUCTION_SETTLEMENT_STATUS, item.settlementStatus)}</Badge></td><td>{item.orderId ?? "Chưa tạo"}</td></tr>; })}</tbody></table></div>{settlements.data.pagination.totalPages > 1 && <AdminPagination page={page} pageSize={settlements.data.pagination.pageSize} totalItems={settlements.data.pagination.totalCount} totalPages={settlements.data.pagination.totalPages} onPageChange={setPage} itemLabel="quyết toán" />}</Card> : !settlements.error && <NoData title="Chưa có phiên đã chốt" />}
  </div>;
}
