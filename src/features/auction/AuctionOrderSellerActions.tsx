"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { AUCTION_ORDER_STATUS, statusLabel } from "@/lib/status-labels";
import { fulfillmentService, OrderProgressStepper, ShipmentTimelineList, TrackingCodeBar } from "@/features/fulfillment";
import { PartnerReviewCard } from "@/features/reviews/PartnerReviewCard";
import { auctionOrderService } from "./services/auction-order.service";

export function AuctionOrderSellerActions({ orderId }: { orderId: string }) {
  const order = useApiResource(`seller-auction-order:${orderId}`, (signal) => auctionOrderService.detail(orderId, signal));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const status = order.data?.status.replace(/[^a-z]/gi, "").toUpperCase() ?? "";
  const canTrack = ["CONFIRMED", "SELLERACCEPTED", "SHIPPING", "SHIPPED", "DELIVERED", "COMPLETED", "RETURNING", "RETURNED"].includes(status);

  const timeline = useApiResource(
    canTrack ? `seller-auction-order-timeline:${orderId}` : null,
    (signal) => fulfillmentService.getAuctionOrderTimeline(orderId, signal),
  );

  const effectiveTrackingCode = order.data?.trackingCode ?? timeline.data?.trackingCode ?? null;
  const effectiveCarrierCode = order.data?.carrierCode ?? timeline.data?.carrierCode ?? null;
  const effectiveLabelPrintUrl = order.data?.labelPrintUrl ?? timeline.data?.labelPrintUrl ?? null;

  const canRetryShipment = Boolean(
    (status === "CONFIRMED" || status === "SELLERACCEPTED") &&
      !effectiveTrackingCode &&
      timeline.data !== undefined,
  );

  const parsedShipping = (() => {
    const raw = order.data?.shippingAddress;
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw) as {
        fullName?: string;
        phoneNumber?: string;
        addressLine?: string;
        wardName?: string;
        districtName?: string;
        provinceName?: string;
      };
      return {
        recipient: [obj.fullName, order.data?.contactPhone ?? obj.phoneNumber].filter(Boolean).join(" · "),
        address: [obj.addressLine, obj.wardName, obj.districtName, obj.provinceName].filter(Boolean).join(", "),
      };
    } catch {
      return { recipient: order.data?.contactPhone ?? "", address: raw };
    }
  })();

  async function respond(accept: boolean) {
    if (busy || status !== "PAID") return;
    if (!accept && !reason.trim()) {
      setError("Nhập lý do từ chối đơn hàng.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (accept) await auctionOrderService.accept(orderId);
      else await auctionOrderService.reject(orderId, reason.trim());
      setNotice(accept ? "Đã tiếp nhận đơn đấu giá và gửi yêu cầu tạo vận đơn GHN." : "Đã từ chối đơn. Hệ thống sẽ cập nhật hoàn tiền.");
      setRejecting(false);
      order.reload();
      if (accept) timeline.reload();
    } catch (cause) {
      // Commerce refuses until the buyer's deposit is captured for this order, so the seller only needs to wait and retry.
      const pendingCapture = cause instanceof ApiError && cause.errorCode === "DEPOSIT_RECONCILIATION_PENDING";
      setError(
        pendingCapture
          ? "Tiền cọc của người mua đang được đối soát với Ví Nexus. Hãy thử lại sau ít phút."
          : cause instanceof Error
            ? cause.message
            : "Không thể xử lý đơn đấu giá.",
      );
      order.reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleRetryShipment() {
    if (retryBusy) return;
    setRetryBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await fulfillmentService.retryAuctionOrderShipment(orderId);
      setNotice(`Đã tạo vận đơn GHN thành công: ${created.trackingCode}.`);
      order.reload();
      timeline.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể tạo lại vận đơn lúc này.");
      order.reload();
      timeline.reload();
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <section className="auction-order-seller" aria-label="Xử lý đơn đấu giá">
      <h2>Đơn hàng thắng đấu giá</h2>
      {order.error && (
        <div className="notice" role="alert">
          {order.error.message}{" "}
          <button type="button" className="button button-secondary button-small" onClick={order.reload}>
            Tải lại
          </button>
        </div>
      )}
      {error && <p className="notice" role="alert">{error}</p>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {order.loading && !order.data && <p>Đang tải đơn hàng…</p>}

      {order.data && (
        <>
          {canTrack && (
            <OrderProgressStepper
              status={timeline.data?.currentStatus ?? order.data.status}
              orderNo={order.data.orderNo}
            />
          )}

          <div className="info-row"><span>Mã đơn</span><strong>{order.data.orderNo}</strong></div>
          <div className="info-row"><span>Sản phẩm</span><strong>{order.data.productName}</strong></div>
          {parsedShipping?.recipient && <div className="info-row"><span>Người nhận</span><strong>{parsedShipping.recipient}</strong></div>}
          {parsedShipping?.address && <div className="info-row"><span>Địa chỉ giao hàng</span><strong style={{ textAlign: "right" }}>{parsedShipping.address}</strong></div>}
          <div className="info-row"><span>Giá trúng</span><strong className="tabular-nums">{formatMoney(order.data.winningAmount)}</strong></div>
          <div className="info-row"><span>Cọc áp dụng</span><strong className="tabular-nums">{formatMoney(order.data.depositAmount)}</strong></div>
          <div className="info-row"><span>Phí giao hàng</span><strong className="tabular-nums">{formatMoney(order.data.shippingFeeAmount)}</strong></div>
          <div className="info-row"><span>Người mua đã trả thêm</span><strong className="tabular-nums">{formatMoney(order.data.totalAmount)}</strong></div>
          <div className="info-row">
            <span>Trạng thái</span>
            <Badge>{statusLabel(AUCTION_ORDER_STATUS, order.data.status)}</Badge>
          </div>
          {order.data.sellerRespondDeadlineAt && (
            <div className="info-row">
              <span>Hạn phản hồi</span>
              <strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.data.sellerRespondDeadlineAt))}</strong>
            </div>
          )}

          {status === "PAID" && (
            <>
              <div className="action-row">
                <button type="button" className="button button-primary" disabled={busy} onClick={() => void respond(true)}>
                  {busy ? "Đang xử lý…" : "Tiếp nhận đơn & tạo vận đơn"}
                </button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => setRejecting((value) => !value)}>
                  Từ chối đơn
                </button>
              </div>
              {rejecting && (
                <div className="auction-reject-form">
                  <label className="field-wrap">
                    Lý do từ chối
                    <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} />
                  </label>
                  <button type="button" className="button auction-danger-button" disabled={busy || !reason.trim()} onClick={() => void respond(false)}>
                    Xác nhận từ chối
                  </button>
                </div>
              )}
            </>
          )}

          {canTrack && (
            <div style={{ marginTop: 14 }}>
              <TrackingCodeBar
                carrierCode={effectiveCarrierCode}
                carrierName={timeline.data?.carrierName}
                trackingCode={effectiveTrackingCode}
                labelPrintUrl={effectiveLabelPrintUrl}
                showPrintLabel
              />
              {canRetryShipment && (
                <div className="action-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={retryBusy}
                    onClick={() => void handleRetryShipment()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Icon name="refreshCw" size={14} />
                    {retryBusy ? "Đang tạo vận đơn…" : "Tạo lại vận đơn GHN"}
                  </button>
                </div>
              )}
              <ShipmentTimelineList
                events={timeline.data?.timeline ?? []}
                loading={timeline.loading}
                refreshing={timeline.loading}
                onRefresh={timeline.reload}
                title="Hành trình giao hàng đấu giá"
              />
            </div>
          )}

          {status === "COMPLETED" && (
            <PartnerReviewCard referenceType="Auction" referenceId={orderId} title="Đánh giá người mua" counterpart="người mua" />
          )}
        </>
      )}
    </section>
  );
}
