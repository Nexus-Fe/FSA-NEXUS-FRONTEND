"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ThumbnailBox } from "@/components/ui/BackendImage";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Badge, Card, PageHeading, TruncatedText } from "@/components/ui/Primitives";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ROUTES } from "@/constants/routes";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney, resolveImageUrl } from "@/lib/presentation";
import { canReportSubOrder, orderReportHref } from "@/features/commerce/order-report";
import { describeBuyerOrderStatus, isCodPaymentMethod } from "@/features/commerce/order-rules";
import { describeCartFailure } from "@/features/commerce/checkout-outcome";
import { ProductQuickPreviewModal, type OrderItemPreviewSnapshot } from "@/features/commerce/ProductQuickPreviewModal";
import { fulfillmentService } from "@/features/fulfillment/services/fulfillment.service";
import { TrackingCodeBar } from "@/features/fulfillment/components/TrackingCodeBar";
import { ShipmentTimelineList } from "@/features/fulfillment/components/ShipmentTimelineList";
import type { TimelineEvent } from "@/features/fulfillment/types";
import "@/features/fulfillment/components/shipping-tracking.css";

type AppliedVoucherDetail = { code: string; scopeType: string; ownerSellerId?: string | null; discountAmount: number };
type SubOrderItem = {
  orderItemId?: string;
  itemId?: string;
  productId: string;
  skuId: string;
  productName: string;
  skuCode?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitPriceAfterDiscount?: number | null;
};
type ShippingAddressSnapshot = {
  receiverName: string;
  receiverPhone?: string | null;
  contactPhone?: string | null;
  street: string;
  ward: string;
  district?: string | null;
  province: string;
  fullAddress?: string | null;
};
type SubOrderDetail = {
  subOrderId: string;
  subOrderNo: string;
  orderId: string;
  buyerId: string;
  sellerId: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  shippingAddress: ShippingAddressSnapshot;
  contactPhone: string;
  itemsAmount: number;
  productDiscountAmount?: number;
  shopDiscountAmount?: number;
  systemDiscountAmount?: number;
  discountAmount?: number;
  shippingFeeAmount: number;
  totalAmount: number;
  createdAt: string;
  items: SubOrderItem[];
  carrierCode?: string | null;
  trackingCode?: string | null;
  shipmentPendingCreation?: boolean;
  sellerAcceptedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  appliedVouchers?: AppliedVoucherDetail[] | null;
};
type ProductImageMap = Record<
  string,
  {
    primaryImageUrl?: string | null;
    images?: Array<{ url: string; isActive?: boolean }>;
    variants?: Array<{ variantId: string; primaryImageUrl?: string | null; images?: Array<{ url: string; isActive?: boolean }> }>;
  } | null
>;

function isFallbackShopName(name: string | null | undefined, sellerId: string): boolean {
  if (!name || !name.trim()) return true;
  const trimmed = name.trim();
  return trimmed.toLowerCase() === `shop ${sellerId.slice(0, 8).toLowerCase()}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("vi-VN");
}

function formatShippingAddress(addr: ShippingAddressSnapshot | null | undefined): string {
  if (!addr) return "—";
  if (addr.fullAddress && addr.fullAddress.trim()) return addr.fullAddress.trim();
  return [addr.street, addr.ward, addr.district, addr.province].filter((p) => p && p.trim()).join(", ") || "—";
}

function describeSellerPreparationStatus(sub: SubOrderDetail): string {
  const key = sub.status.replace(/[^a-z]/gi, "").toUpperCase();
  if (key === "PENDINGPAYMENT") {
    return isCodPaymentMethod(sub.paymentMethod)
      ? "Đang chờ người bán xác nhận đơn COD"
      : "Chờ người mua hoàn tất thanh toán";
  }
  if (key === "PAID" || key === "PENDINGCONFIRMATION") {
    return "Đã thanh toán · Đang chờ người bán xác nhận";
  }
  if (key === "CONFIRMED" || key === "SELLERACCEPTED") {
    return "Người bán đã xác nhận · Đang chuẩn bị hàng";
  }
  if (key === "SHIPPING" || key === "SHIPPED") {
    return "Đơn vị vận chuyển đang giao hàng";
  }
  if (key === "DELIVERED") return "Đã giao hàng thành công";
  if (key === "COMPLETED") return "Đơn hàng đã hoàn tất";
  if (key === "CANCELLED") return "Đơn hàng đã hủy";
  if (key === "SELLERREJECTED") return "Người bán đã từ chối đơn hàng";
  if (key === "RETURNING") return "Kiện hàng đang hoàn về người bán";
  if (key === "REFUNDED") return "Đơn hàng đã được hoàn tiền";
  return describeBuyerOrderStatus(sub.status, sub.paymentMethod);
}

function buildAugmentedTimeline(sub: SubOrderDetail, rawEvents: TimelineEvent[]): TimelineEvent[] {
  const events = [...rawEvents];
  const hasPlaced = events.some((e) => e.status.replace(/[^a-z]/gi, "").toUpperCase() === "PENDINGPAYMENT");
  const hasPaid = events.some((e) => e.status.replace(/[^a-z]/gi, "").toUpperCase() === "PAID");
  const hasConfirmed = events.some((e) => {
    const k = e.status.replace(/[^a-z]/gi, "").toUpperCase();
    return k === "CONFIRMED" || k === "SELLERACCEPTED";
  });

  if (!hasPlaced) {
    events.unshift({
      status: "PendingPayment",
      title: "Đặt hàng thành công",
      description: isCodPaymentMethod(sub.paymentMethod)
        ? "Đơn hàng COD đã tạo và đang đợi người bán xác nhận."
        : "Đơn hàng đã được tạo.",
      occurredAt: sub.createdAt,
      location: null,
    });
  }

  if (!hasPaid && !isCodPaymentMethod(sub.paymentMethod) && (hasConfirmed || sub.status.toUpperCase() !== "PENDINGPAYMENT")) {
    const placedIdx = events.findIndex((e) => e.status.replace(/[^a-z]/gi, "").toUpperCase() === "PENDINGPAYMENT");
    events.splice(placedIdx + 1, 0, {
      status: "Paid",
      title: "Đã thanh toán · Chờ người bán xác nhận",
      description: "Thanh toán thành công qua Ví Nexus. Đang đợi người bán xác nhận và chuẩn bị hàng.",
      occurredAt: sub.createdAt,
      location: null,
    });
  }

  return events;
}

export function SubOrderDetailScreen({
  overrideOrderId,
  overrideSubOrderId,
}: {
  overrideOrderId?: string;
  overrideSubOrderId?: string;
} = {}) {
  const params = useParams<{ id?: string; subOrderId?: string }>();
  const orderId = overrideOrderId ?? String(params.id ?? "");
  const subOrderId = overrideSubOrderId ?? String(params.subOrderId ?? "");

  const subResource = useApiResource(
    subOrderId ? `buyer-sub-order:${subOrderId}` : null,
    (signal) =>
      api
        .get<ApiResponse<SubOrderDetail> | SubOrderDetail>(
          `/api/v1/sub-orders/${encodeURIComponent(subOrderId)}`,
          { signal },
        )
        .then(unwrap),
  );

  const sub = subResource.data;

  const sellerProfile = useApiResource(
    sub && isFallbackShopName(sub.shopName, sub.sellerId) ? `seller-shop:${sub.sellerId}` : null,
    async (signal) => {
      try {
        return unwrap(
          await api.get<ApiResponse<{ shopName?: string | null }> | { shopName?: string | null }>(
            `/api/v1/sellers/${encodeURIComponent(sub!.sellerId)}`,
            { signal },
          ),
        );
      } catch {
        return null;
      }
    },
  );

  const productIds = sub ? [...new Set(sub.items.map((i) => i.productId).filter(Boolean))] : [];
  const productDetails = useApiResource(
    productIds.length ? `suborder-products:${productIds.join(",")}` : null,
    async (signal) => {
      const pairs = await Promise.all(
        productIds.map(async (pid) => {
          try {
            const detail = unwrap(
              await api.get<ApiResponse<ProductImageMap[string]> | ProductImageMap[string]>(
                `/api/v1/products/${encodeURIComponent(pid)}`,
                { signal },
              ),
            );
            return [pid, detail] as const;
          } catch {
            return [pid, null] as const;
          }
        }),
      );
      return Object.fromEntries(pairs) as ProductImageMap;
    },
  );

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<OrderItemPreviewSnapshot | null>(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [awaitingReceiptConfirm, setAwaitingReceiptConfirm] = useState(false);
  const [cancellingSubOrder, setCancellingSubOrder] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const timeline = useApiResource(
    timelineOpen && subOrderId ? `sub-order-timeline:${subOrderId}` : null,
    (signal) => fulfillmentService.getSubOrderTimeline(subOrderId, signal),
  );
  const carrier = useApiResource(
    timelineOpen && sub?.trackingCode ? `buyer-shipment-carrier:${sub.trackingCode}` : null,
    (signal) => fulfillmentService.getShipmentByTracking(sub?.trackingCode ?? "", signal),
  );

  const resolvedShopName = sub
    ? !isFallbackShopName(sub.shopName, sub.sellerId)
      ? sub.shopName
      : sellerProfile.data?.shopName?.trim() || sub.shopName
    : "";

  const effectiveOrderId = sub?.orderId || orderId;
  const statusKey = (sub?.status ?? "").replace(/[^a-z]/gi, "").toUpperCase();
  const canConfirmReceipt = ["SHIPPING", "SHIPPED", "DELIVERED"].includes(statusKey);
  const isCompleted = statusKey === "COMPLETED";
  const isRejected = statusKey === "SELLERREJECTED";
  const isCancelled = statusKey === "CANCELLED" || statusKey === "REFUNDED";
  const canCancelSub = ["PENDINGPAYMENT", "PAID", "CONFIRMED", "SELLERACCEPTED"].includes(statusKey);
  const showReceiptAction = Boolean(sub && !isCompleted && !isRejected && !isCancelled);

  async function handleConfirmReceipt() {
    if (!sub || !awaitingReceiptConfirm || confirmingReceipt) return;
    setConfirmingReceipt(true);
    setActionError("");
    setActionMessage("");
    try {
      await api.post(`/api/v1/sub-orders/${encodeURIComponent(sub.subOrderId)}/confirm-receipt`, {});
      setAwaitingReceiptConfirm(false);
      setActionMessage("Đã xác nhận nhận hàng. Hệ thống đang cập nhật trạng thái giải ngân cho người bán.");
      subResource.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setConfirmingReceipt(false);
    }
  }

  async function handleCancelSubOrder() {
    if (!sub || cancellingSubOrder) return;
    setCancellingSubOrder(true);
    setActionError("");
    setActionMessage("");
    try {
      await api.post(`/api/v1/sub-orders/${encodeURIComponent(sub.subOrderId)}/cancel`, {
        reasonCode: "BuyerChangedMind",
        reasonNote: "Người mua chủ động hủy đơn hàng shop trước khi giao",
      });
      setActionMessage("Đã hủy đơn hàng của gian hàng này. Kho và khoản thanh toán Ví (nếu có) sẽ được hoàn lại.");
      subResource.reload();
    } catch (reason) {
      setActionError(describeCartFailure(reason));
    } finally {
      setCancellingSubOrder(false);
    }
  }

  const productDisc = sub?.productDiscountAmount ?? 0;
  const shopDisc = sub?.shopDiscountAmount ?? 0;
  const sysDisc = sub?.systemDiscountAmount ?? 0;
  const totalDisc = productDisc + shopDisc + sysDisc || (sub?.discountAmount ?? 0);
  const originalTotal = sub ? sub.itemsAmount + sub.shippingFeeAmount : 0;
  const productCodes = sub?.appliedVouchers?.filter((v) => v.scopeType === "Product").map((v) => v.code) ?? [];
  const shopCodes = sub?.appliedVouchers?.filter((v) => v.scopeType === "Shop").map((v) => v.code) ?? [];
  const systemCodes = sub?.appliedVouchers?.filter((v) => v.scopeType === "System").map((v) => v.code) ?? [];

  return (
    <div className="order-page-shell">
      <PageHeading
        title={sub ? `${resolvedShopName} · ${sub.subOrderNo}` : "Chi tiết đơn hàng shop"}
        action={
          effectiveOrderId ? (
            <div className="action-row">
              {sub && canCancelSub && (
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ borderColor: "var(--danger, #dc2626)", color: "var(--danger, #dc2626)" }}
                  disabled={cancellingSubOrder}
                  onClick={() => void handleCancelSubOrder()}
                >
                  {cancellingSubOrder ? "Đang hủy…" : "Hủy đơn shop"}
                </button>
              )}
              <Link className="button button-secondary" href={ROUTES.buyer.order(effectiveOrderId)}>
                Về chi tiết đơn tổng
              </Link>
            </div>
          ) : undefined
        }
      />

      {actionError && <p className="notice" role="alert">{actionError}</p>}
      {actionMessage && <p className="form-success" role="status">{actionMessage}</p>}
      {subResource.error && <ErrorState cause={subResource.error} onRetry={subResource.reload} />}
      {subResource.loading && !sub && <LoadingState rows={5} label="Đang tải chi tiết đơn hàng shop…" />}

      {sub && (
        <div className="suborder-detail-grid">
          <div className="suborder-detail-left">
            <Card className="card-pad">
              <button
                type="button"
                className="suborder-address-trigger"
                onClick={() => setAddressModalOpen(true)}
              >
                <div className="suborder-address-summary">
                  <div className="suborder-address-shop">
                    <Icon name="store" size={16} />
                    <strong>{resolvedShopName}</strong>
                    <Badge>{describeBuyerOrderStatus(sub.status, sub.paymentMethod)}</Badge>
                  </div>
                  <div className="suborder-address-line">
                    <Icon name="mapPin" size={15} />
                    <span>{formatShippingAddress(sub.shippingAddress)}</span>
                  </div>
                </div>
                <span className="suborder-address-cta">
                  <span>Chi tiết</span>
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            </Card>

            <Card className="card-pad">
              {showReceiptAction && (
                <div className="order-status-banner" role="status" style={{ marginBottom: 16 }}>
                  <div>
                    <strong>
                      {["CONFIRMED", "SELLERACCEPTED", "SHIPPING", "SHIPPED", "DELIVERED"].includes(statusKey)
                        ? `Người bán đang xử lý đơn hàng ${sub.subOrderNo}`
                        : `Đơn hàng ${sub.subOrderNo} đang chờ xử lý`}
                    </strong>
                    <p>
                      {canConfirmReceipt
                        ? "Chỉ xác nhận khi bạn đã thực sự nhận được hàng."
                        : "Bạn có thể xác nhận sau khi đơn chuyển sang đang giao hoặc đã giao."}
                    </p>
                    {awaitingReceiptConfirm && (
                      <p role="alert" style={{ marginTop: 8 }}>
                        Xác nhận sẽ hoàn tất đơn và bắt đầu giải ngân cho người bán. Chỉ tiếp tục khi bạn đã nhận được hàng.
                      </p>
                    )}
                  </div>
                  <div className="action-row" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={!canConfirmReceipt || confirmingReceipt}
                      onClick={() => {
                        if (awaitingReceiptConfirm) void handleConfirmReceipt();
                        else {
                          setActionError("");
                          setAwaitingReceiptConfirm(true);
                        }
                      }}
                    >
                      {confirmingReceipt ? "Đang xác nhận…" : awaitingReceiptConfirm ? "Xác nhận đã nhận hàng" : "Đã nhận được hàng"}
                    </button>
                    {awaitingReceiptConfirm && (
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={confirmingReceipt}
                        onClick={() => setAwaitingReceiptConfirm(false)}
                      >
                        Quay lại
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isRejected && (
                <div className="notice" role="alert" style={{ marginBottom: 16 }}>
                  {isCodPaymentMethod(sub.paymentMethod) ? (
                    <strong>Đơn hàng COD đã bị người bán từ chối.</strong>
                  ) : (
                    <>
                      <strong>Đơn hàng đã bị người bán từ chối.</strong> Vui lòng kiểm tra lịch sử <strong>Ví Nexus</strong> để xác nhận khoản hoàn tiền.
                    </>
                  )}
                </div>
              )}

              {isCancelled && !isRejected && (
                <div className="notice" role="status" style={{ marginBottom: 16 }}>
                  <strong>Đơn hàng đã hủy.</strong> Tồn kho giữ chỗ đã được nhả lại và khoản thanh toán Ví (nếu có) đã được hoàn trả.
                </div>
              )}

              {isCompleted && (
                <div className="form-success" role="status" style={{ marginBottom: 16 }}>
                  <strong>Đơn hàng đã hoàn tất!</strong> Bạn đã xác nhận nhận hàng thành công.
                </div>
              )}

              <div className="suborder-items-head">
                <h2>Sản phẩm trong đơn ({sub.items.length})</h2>
                {canReportSubOrder(sub.status) && (
                  <Link className="suborder-report-link" href={orderReportHref(sub)}>
                    Báo cáo vấn đề với người bán
                  </Link>
                )}
              </div>

              <div className="suborder-items-list">
                {sub.items.map((item, idx) => {
                  const detail = productDetails.data?.[item.productId];
                  const variant = detail?.variants?.find((v) => v.variantId === item.skuId);
                  const imageUrl =
                    variant?.primaryImageUrl ??
                    variant?.images?.find((img) => img.isActive !== false)?.url ??
                    detail?.primaryImageUrl ??
                    detail?.images?.find((img) => img.isActive !== false)?.url ??
                    null;
                  const hasProductDiscount =
                    item.unitPriceAfterDiscount != null && item.unitPriceAfterDiscount < item.unitPrice;
                  const recordedUnitPrice = hasProductDiscount ? item.unitPriceAfterDiscount! : item.unitPrice;
                  const recordedLineTotal = hasProductDiscount ? recordedUnitPrice * item.quantity : item.lineTotal;

                  return (
                    <button
                      type="button"
                      key={item.orderItemId ?? item.itemId ?? `${item.skuId}-${idx}`}
                      className="suborder-item-row"
                      onClick={() =>
                        setPreviewItem({
                          productId: item.productId,
                          skuId: item.skuId,
                          productName: item.productName,
                          skuCode: item.skuCode,
                          quantity: item.quantity,
                          unitPrice: item.unitPrice,
                          unitPriceAfterDiscount: item.unitPriceAfterDiscount,
                          lineTotal: item.lineTotal,
                          shopName: resolvedShopName,
                          imageUrl,
                        })
                      }
                    >
                      <ThumbnailBox src={resolveImageUrl(imageUrl)} alt={item.productName} size={48} />
                      <span className="suborder-item-content">
                        <span className="suborder-item-info">
                          <strong><TruncatedText text={item.productName} label="Tên sản phẩm" block /></strong>
                          <small>
                            {item.skuCode ? `SKU: ${item.skuCode} · ` : ""}
                            Số lượng: <b className="suborder-item-qty">× {item.quantity}</b>
                          </small>
                        </span>
                        <span className="suborder-item-price">
                          <span className="price-stack-inline">
                            {hasProductDiscount && (
                              <span className="price-strikethrough">{formatMoney(item.unitPrice)}</span>
                            )}
                            <span>{formatMoney(recordedUnitPrice)}</span>
                          </span>
                          <small>Thành tiền: {formatMoney(recordedLineTotal)}</small>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="suborder-payment-dropdown">
                <button
                  type="button"
                  className="suborder-payment-toggle"
                  aria-expanded={discountOpen}
                  onClick={() => setDiscountOpen((prev) => !prev)}
                >
                  <span className="suborder-payment-toggle-label">
                    <Icon name="receipt" size={16} />
                    <span>Tổng thanh toán</span>
                  </span>
                  <span className="suborder-payment-toggle-amount">
                    {totalDisc > 0 && originalTotal > sub.totalAmount && (
                      <span className="price-strikethrough">{formatMoney(originalTotal)}</span>
                    )}
                    <strong>{formatMoney(sub.totalAmount)}</strong>
                    <Icon
                      name="chevronDown"
                      size={16}
                      className={discountOpen ? "is-rotated" : undefined}
                    />
                  </span>
                </button>

                {discountOpen && (
                  <div className="suborder-payment-breakdown">
                    <div className="info-row">
                      <span>Tổng tiền hàng (giá gốc lúc mua)</span>
                      <strong>{formatMoney(sub.itemsAmount)}</strong>
                    </div>
                    <div className="info-row">
                      <span>Phí vận chuyển</span>
                      <strong>{formatMoney(sub.shippingFeeAmount)}</strong>
                    </div>
                    {productDisc > 0 && (
                      <div className="info-row suborder-discount-row">
                        <span>Giảm giá sản phẩm{productCodes.length ? ` (${productCodes.join(", ")})` : ""}</span>
                        <strong>−{formatMoney(productDisc)}</strong>
                      </div>
                    )}
                    {shopDisc > 0 && (
                      <div className="info-row suborder-discount-row">
                        <span>Giảm giá từ shop{shopCodes.length ? ` (${shopCodes.join(", ")})` : ""}</span>
                        <strong>−{formatMoney(shopDisc)}</strong>
                      </div>
                    )}
                    {sysDisc > 0 && (
                      <div className="info-row suborder-discount-row">
                        <span>Giảm giá toàn sàn{systemCodes.length ? ` (${systemCodes.join(", ")})` : ""}</span>
                        <strong>−{formatMoney(sysDisc)}</strong>
                      </div>
                    )}
                    {totalDisc > 0 && productDisc === 0 && shopDisc === 0 && sysDisc === 0 && (
                      <div className="info-row suborder-discount-row">
                        <span>Tổng giảm giá</span>
                        <strong>−{formatMoney(totalDisc)}</strong>
                      </div>
                    )}
                    <div className="info-row">
                      <span>Tổng ban đầu (gồm phí giao hàng)</span>
                      <strong className={totalDisc > 0 ? "price-strikethrough" : undefined}>
                        {formatMoney(originalTotal)}
                      </strong>
                    </div>
                    <div className="info-row suborder-final-row">
                      <span>Thành tiền cuối cùng</span>
                      <strong>{formatMoney(sub.totalAmount)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {isCompleted && (
                <div className="action-row" style={{ marginTop: 14 }}>
                  <Link className="button button-secondary" href={ROUTES.buyer.orderReview(effectiveOrderId)}>
                    Đánh giá sản phẩm và gian hàng
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <div className="suborder-detail-right">
            <Card className="card-pad">
              <div className="suborder-delivery-head">
                <h2>
                  <Icon name="truck" size={17} />
                  <span>Thông tin giao hàng</span>
                </h2>
                <Badge>{describeBuyerOrderStatus(sub.status, sub.paymentMethod)}</Badge>
              </div>

              <div className="info-row">
                <span>Mã đơn con</span>
                <strong className="seller-wrap-value">{sub.subOrderNo}</strong>
              </div>
              <div className="info-row">
                <span>Trạng thái xử lý</span>
                <strong>{describeSellerPreparationStatus(sub)}</strong>
              </div>
              <div className="info-row">
                <span>Đơn vị vận chuyển</span>
                <strong>{sub.carrierCode || "GHN"}</strong>
              </div>
              <div className="info-row">
                <span>Ngày đặt đơn</span>
                <strong>{formatDateTime(sub.createdAt)}</strong>
              </div>
              {sub.sellerAcceptedAt && (
                <div className="info-row">
                  <span>Người bán xác nhận</span>
                  <strong>{formatDateTime(sub.sellerAcceptedAt)}</strong>
                </div>
              )}
              {sub.shippedAt && (
                <div className="info-row">
                  <span>Bàn giao vận chuyển</span>
                  <strong>{formatDateTime(sub.shippedAt)}</strong>
                </div>
              )}
              {sub.deliveredAt && (
                <div className="info-row">
                  <span>Thời gian giao hàng</span>
                  <strong>{formatDateTime(sub.deliveredAt)}</strong>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {sub.trackingCode ? (
                  <TrackingCodeBar carrierCode={sub.carrierCode} trackingCode={sub.trackingCode} />
                ) : (
                  <p className="suborder-tracking-pending">
                    Chưa có mã vận đơn (sẽ được tạo sau khi người bán xác nhận đơn hàng).
                  </p>
                )}
              </div>

              <div className="action-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ width: "100%" }}
                  onClick={() => setTimelineOpen((prev) => !prev)}
                >
                  {timelineOpen ? "Ẩn hành trình đơn hàng" : "Xem hành trình đơn hàng"}
                </button>
              </div>

              {timelineOpen && (
                <div style={{ marginTop: 16 }}>
                  {timeline.error ? (
                    <ErrorState cause={timeline.error} onRetry={timeline.reload} />
                  ) : (
                    <ShipmentTimelineList
                      events={timeline.data ? buildAugmentedTimeline(sub, timeline.data.timeline ?? []) : []}
                      carrierEvents={carrier.data?.events}
                      loading={timeline.loading}
                      refreshing={timeline.loading || carrier.loading}
                      onRefresh={() => {
                        timeline.reload();
                        if (sub.trackingCode) carrier.reload();
                        subResource.reload();
                      }}
                    />
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal
        open={addressModalOpen && Boolean(sub)}
        title="Thông tin nhận hàng"
        onClose={() => setAddressModalOpen(false)}
        footer={
          <button type="button" className="button button-secondary" onClick={() => setAddressModalOpen(false)}>
            Đóng
          </button>
        }
      >
        {sub && (
          <div>
            <div className="info-row">
              <span>Gian hàng</span>
              <strong>{resolvedShopName}</strong>
            </div>
            <div className="info-row">
              <span>Người nhận</span>
              <strong>{sub.shippingAddress?.receiverName || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Số điện thoại</span>
              <strong>{sub.contactPhone || sub.shippingAddress?.receiverPhone || sub.shippingAddress?.contactPhone || "—"}</strong>
            </div>
            <div className="info-row">
              <span>Địa chỉ nhận hàng</span>
              <strong>{formatShippingAddress(sub.shippingAddress)}</strong>
            </div>
            <div className="info-row">
              <span>Thời gian đặt đơn</span>
              <strong>{formatDateTime(sub.createdAt)}</strong>
            </div>
            <div className="info-row">
              <span>Phương thức thanh toán</span>
              <strong>{isCodPaymentMethod(sub.paymentMethod) ? "Thanh toán khi nhận hàng (COD)" : "Ví Nexus"}</strong>
            </div>
          </div>
        )}
      </Modal>

      <ProductQuickPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </div>
  );
}
