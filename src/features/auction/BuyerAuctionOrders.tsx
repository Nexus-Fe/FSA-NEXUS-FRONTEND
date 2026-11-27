"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPagination, Badge, Card, clickableRowProps, NoData, PageHeading } from "@/components/ui/Primitives";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { AUCTION_ORDER_STATUS, semanticStatusTone, statusLabel } from "@/lib/status-labels";
import { auctionOrderService } from "./services/auction-order.service";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "PendingPayment", label: "Chờ thanh toán" },
  { value: "Paid", label: "Đã thanh toán, chờ xác nhận" },
  { value: "Confirmed", label: "Chờ lấy hàng" },
  { value: "Shipping", label: "Đang giao hàng" },
  { value: "Delivered", label: "Đã giao hàng" },
  { value: "Completed", label: "Hoàn tất" },
  { value: "Cancelled", label: "Đã hủy" },
  { value: "Expired", label: "Hết hạn thanh toán" },
  { value: "Refunded", label: "Đã hoàn tiền" },
] as const;

export function BuyerAuctionOrders() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const orders = useApiResource(
    `buyer-auction-orders:${page}:${statusFilter}`,
    (signal) => auctionOrderService.buyerList(page, statusFilter || undefined, signal),
  );
  const items = orders.data?.items ?? [];

  return (
    <div className="auction-surface">
      <PageHeading
        overline="Đấu giá"
        title="Đơn hàng đấu giá của tôi"
        description="Theo dõi các đơn hàng sau khi thắng phiên đấu giá hoặc mua ngay, cập nhật địa chỉ giao hàng, thanh toán phần còn lại và xác nhận nhận hàng."
        action={
          <Link className="button button-secondary button-small" href={ROUTES.buyer.auctions}>
            Về đấu giá của tôi
          </Link>
        }
      />
      <div className="auction-settlement-filters">
        <label className="field-wrap auction-settlement-filter">
          Trạng thái đơn
          <select
            className="select-field"
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {orders.error && (
        <div className="notice" role="alert">
          {orders.error.message}{" "}
          <button type="button" className="button button-secondary button-small" onClick={orders.reload}>
            Tải lại
          </button>
        </div>
      )}
      {orders.loading && !orders.data ? (
        <NoData title="Đang tải đơn hàng đấu giá…" />
      ) : items.length ? (
        <Card>
          <div className="table-scroll">
            <table className="data-table auction-operations-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Sản phẩm</th>
                  <th>Giá trúng</th>
                  <th>Tổng thanh toán</th>
                  <th>Hạn thanh toán</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => {
                  const isPendingPayment = order.status.replace(/[^a-z]/gi, "").toUpperCase() === "PENDINGPAYMENT";
                  const detailHref = isPendingPayment
                    ? ROUTES.buyer.auctionPayment(order.auctionId)
                    : ROUTES.buyer.auctionResult(order.auctionId);
                  return (
                    <tr
                      key={order.id}
                      {...clickableRowProps(() => router.push(detailHref), "Nhấn để xem chi tiết đơn đấu giá")}
                    >
                      <td>
                        <Link href={detailHref} onClick={(event) => event.stopPropagation()}>
                          <strong>{order.orderNo}</strong>
                        </Link>
                        {order.trackingCode && (
                          <div style={{ fontSize: 12, color: "var(--primary)", marginTop: 2 }}>
                            GHN: <strong className="mono">{order.trackingCode}</strong>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <ThumbnailBox src={resolveImageUrl(order.imageUrl ?? null)} alt={order.productName} size={42} />
                          <span>{order.productName}</span>
                        </div>
                      </td>
                      <td>{formatMoney(order.winningAmount)}</td>
                      <td>{order.totalAmount != null ? formatMoney(order.totalAmount) : "Chưa tính phí ship"}</td>
                      <td>
                        {order.paymentDeadlineAt
                          ? new Date(order.paymentDeadlineAt).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                      <td>
                        <Badge tone={semanticStatusTone(order.status)}>
                          {statusLabel(AUCTION_ORDER_STATUS, order.status)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {orders.data && orders.data.totalPages > 1 && (
            <AdminPagination
              page={page}
              pageSize={orders.data.pageSize}
              totalItems={orders.data.totalCount}
              totalPages={orders.data.totalPages}
              onPageChange={setPage}
              itemLabel="đơn đấu giá"
            />
          )}
        </Card>
      ) : (
        !orders.error && <NoData title="Bạn chưa có đơn hàng đấu giá nào" />
      )}
    </div>
  );
}
