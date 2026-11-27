"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPagination, Badge, Card, clickableRowProps, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { AUCTION_ORDER_STATUS, statusLabel } from "@/lib/status-labels";
import { auctionOrderService } from "./services/auction-order.service";

function auctionOrderStatusLabel(status: string): string {
  return statusLabel(AUCTION_ORDER_STATUS, status);
}

export function SellerAuctionOrders() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const orders = useApiResource(`seller-auction-orders:${page}`, (signal) => auctionOrderService.sellerList(page, signal));
  const items = (orders.data?.items ?? []).filter((order) => !statusFilter || order.status.toUpperCase() === statusFilter.toUpperCase());
  return <div className="auction-surface">
    <PageHeading title="Đơn hàng đấu giá" description="Theo dõi thanh toán và phản hồi đơn của người thắng." />
    <div className="auction-settlement-filters">
      <label className="field-wrap auction-settlement-filter">Trạng thái đơn
        <select className="select-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Tất cả</option>
          <option value="PendingPayment">Chờ thanh toán</option>
          <option value="Paid">Đã thanh toán, chờ xác nhận</option>
          <option value="Confirmed">Chờ lấy hàng</option>
          <option value="Shipped">Đang giao hàng</option>
          <option value="Delivered">Đã giao hàng</option>
          <option value="Completed">Hoàn tất</option>
          <option value="Cancelled">Đã hủy</option>
          <option value="Expired">Hết hạn thanh toán</option>
          <option value="Refunded">Đã hoàn tiền</option>
        </select>
      </label>
    </div>
    {orders.error && <div className="notice" role="alert">{orders.error.message} <button type="button" className="button button-secondary button-small" onClick={orders.reload}>Tải lại</button></div>}
    {orders.loading && !orders.data ? <NoData title="Đang tải đơn đấu giá…" /> : items.length ? <Card><div className="table-scroll"><table className="data-table auction-operations-table"><thead><tr><th>Mã đơn</th><th>Sản phẩm</th><th>Mã vận đơn GHN</th><th>Giá trúng</th><th>Trạng thái</th></tr></thead><tbody>{items.map((order) => { const detailHref = ROUTES.seller.auctionResult(order.auctionId); return <tr key={order.id} {...clickableRowProps(() => router.push(detailHref), "Nhấn để xem đơn đấu giá")}><td><Link href={detailHref}><strong>{order.orderNo}</strong></Link></td><td>{order.productName}</td><td>{order.trackingCode ? <strong className="mono">{order.trackingCode}</strong> : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}</td><td className="tabular-nums">{formatMoney(order.winningAmount)}</td><td><Badge tone={order.status.toUpperCase() === "PAID" ? "sky" : order.status.toUpperCase() === "COMPLETED" ? "green" : order.status.toUpperCase().includes("CANCEL") ? "red" : "slate"}>{auctionOrderStatusLabel(order.status)}</Badge></td></tr>; })}</tbody></table></div>{orders.data && orders.data.totalPages > 1 && <AdminPagination page={page} pageSize={orders.data.pageSize} totalItems={orders.data.totalCount} totalPages={orders.data.totalPages} onPageChange={setPage} itemLabel="đơn đấu giá" />}</Card> : !orders.error && <NoData title="Chưa có đơn đấu giá" />}
  </div>;
}
