"use client";

import { useState, type FormEvent } from "react";
import { ButtonLink } from "@/components/ui/Primitives";
import { useToast } from "@/components/ui/Toast";
import { ROUTES } from "@/constants/routes";
import { notifyNotificationsChanged } from "@/features/notification";
import { auctionOrderService } from "./services/auction-order.service";
import { useApiResource } from "@/lib/api/use-api-resource";
import { formatMoney } from "@/lib/presentation";
import { walletService } from "@/features/wallet/services/wallet.service";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { EMPTY_GHN_SELECTION, validateGhnSelection, type GhnSelection } from "@/features/shipping/ghn-address";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { fulfillmentService, OrderProgressStepper, ShipmentTimelineList, TrackingCodeBar } from "@/features/fulfillment";
import { PartnerReviewCard } from "@/features/reviews/PartnerReviewCard";
import { ProductReviewCard } from "@/features/reviews/ProductReviewCard";
import { auctionOrderStatusLabel } from "./AuctionResultExtras";

type AddressForm = { fullName: string; phoneNumber: string; addressLine: string };
const initialAddress: AddressForm = { fullName: "", phoneNumber: "", addressLine: "" };
const addressFields = [["fullName", "Người nhận"], ["phoneNumber", "Số điện thoại"], ["addressLine", "Số nhà, đường"]] as const;
const writeFailure = (cause: unknown) => formatError(describeError(cause, { operation: "write" }));

export function AuctionOrderPayment({ orderId, deadlinePassed, onOrderChanged }: { orderId: string; deadlinePassed: boolean; onOrderChanged?: () => void }) {
  const { showToast } = useToast();
  const order = useApiResource(`auction-order:${orderId}`, (signal) => auctionOrderService.detail(orderId, signal));
  const [shipping, setShipping] = useState<AddressForm>(initialAddress);
  const [ghn, setGhn] = useState<GhnSelection>(EMPTY_GHN_SELECTION);
  const [ghnErrors, setGhnErrors] = useState<ReturnType<typeof validateGhnSelection>>({});
  const [busy, setBusy] = useState(false);
  const [confirmReceipt, setConfirmReceipt] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const status = order.data?.status.replace(/[^a-z]/gi, "").toUpperCase();
  const payable = status === "PENDINGPAYMENT" && !deadlinePassed;
  const canTrack = ["CONFIRMED", "SELLERACCEPTED", "SHIPPING", "SHIPPED", "DELIVERED", "COMPLETED", "RETURNING", "RETURNED"].includes(status ?? "");
  const timeline = useApiResource(
    canTrack ? `buyer-auction-order-timeline:${orderId}` : null,
    (signal) => fulfillmentService.getAuctionOrderTimeline(orderId, signal),
  );
  const effectiveTrackingCode = order.data?.trackingCode ?? timeline.data?.trackingCode ?? null;
  const effectiveCarrierCode = order.data?.carrierCode ?? timeline.data?.carrierCode ?? null;
  const wallet = useApiResource(payable ? `auction-order-wallet:${orderId}` : null, (signal) => walletService.getBalance(signal));
  const availableBalance = wallet.data?.availableBalance;
  const insufficientWallet = Boolean(payable && order.data?.totalAmount != null && availableBalance !== undefined && availableBalance < order.data.totalAmount);

  async function saveShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateGhnSelection(ghn);
    setGhnErrors(found);
    if (Object.keys(found).length > 0 || !ghn.districtId || !/^(0|\+84)\d{9,10}$/.test(shipping.phoneNumber.replace(/\s/g, "")) || !shipping.fullName.trim() || !shipping.addressLine.trim()) {
      setError("Kiểm tra lại họ tên, số điện thoại, địa chỉ và chọn đủ tỉnh, quận, phường."); return;
    }
    setBusy(true); setError(""); setSuccess("");
    try {
      await auctionOrderService.submitShipping(orderId, { ...shipping, provinceName: ghn.provinceName, districtName: ghn.districtName, wardName: ghn.wardName, provinceId: ghn.provinceId as number, ghnDistrictId: ghn.districtId, ghnWardCode: ghn.wardCode });
      setSuccess("Đã lưu địa chỉ và tính phí giao hàng."); order.reload(); onOrderChanged?.();
    } catch (cause) { setError(writeFailure(cause)); }
    finally { setBusy(false); }
  }

  async function pay() {
    if (busy || !payable || order.data?.totalAmount === null || order.data?.totalAmount === undefined) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const result = await auctionOrderService.pay(orderId);
      if (result.status.toUpperCase() === "PAID") {
        setSuccess("Đã thanh toán bằng Ví Nexus.");
        showToast("Thanh toán đơn đấu giá thành công.", "success");
        notifyNotificationsChanged(true);
      }
      order.reload(); onOrderChanged?.();
    } catch (cause) { setError(writeFailure(cause)); order.reload(); onOrderChanged?.(); }
    finally { setBusy(false); }
  }

  async function receive() {
    if (busy || !["SHIPPED", "DELIVERED"].includes(status ?? "")) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await auctionOrderService.confirmReceipt(orderId);
      setSuccess("Đã xác nhận nhận hàng."); setConfirmReceipt(false); order.reload(); onOrderChanged?.();
    } catch (cause) { setError(writeFailure(cause)); }
    finally { setBusy(false); }
  }

  return <section className="auction-order-payment" aria-label="Thanh toán đơn đấu giá">
    {order.loading && !order.data && <p>Đang tải đơn đấu giá…</p>}
    {order.error && <div role="alert" className="notice">{formatError(describeError(order.error, { operation: "read" }))} <button type="button" className="button button-secondary button-small" onClick={order.reload}>Tải lại</button></div>}
    {order.data && <>
      {canTrack && (
        <OrderProgressStepper
          status={timeline.data?.currentStatus ?? order.data.status}
          orderNo={order.data.orderNo}
        />
      )}
      <div className="info-row"><span>Mã đơn</span><strong>{order.data.orderNo}</strong></div>
      <div className="info-row"><span>Sản phẩm</span><strong>{order.data.productName}</strong></div>
      {order.data.orderSource === "BUY_NOW" && <p className="notice" role="status">Tiền hàng đã được khóa trong ví. Bạn chỉ cần thanh toán phí giao hàng{order.data.paymentDeadlineAt ? ` trước ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.data.paymentDeadlineAt))}` : ""}.</p>}
      <div className="info-row"><span>Giá trúng</span><strong>{formatMoney(order.data.winningAmount)}</strong></div>
      <div className="info-row"><span>Cọc áp dụng</span><strong>−{formatMoney(order.data.depositAmount)}</strong></div>
      <div className="info-row"><span>Phí giao hàng</span><strong>{formatMoney(order.data.shippingFeeAmount)}</strong></div>
      <div className="info-row"><span>Còn phải trả</span><strong>{formatMoney(order.data.totalAmount)}</strong></div>
      {payable && (
        <div className="info-row">
          <span>Số dư khả dụng</span>
          <strong>{wallet.loading && availableBalance === undefined ? "Đang tải…" : availableBalance !== undefined ? formatMoney(availableBalance) : "Không xác định"}</strong>
        </div>
      )}
      {insufficientWallet && <p className="notice" role="status">Số dư khả dụng chưa đủ để thanh toán phần còn lại. Hãy nạp thêm vào Ví Nexus.</p>}
      <div className="info-row"><span>Trạng thái</span><strong>{auctionOrderStatusLabel(order.data.status)}</strong></div>
      {payable && order.data.totalAmount === null && <form className="auction-shipping-form" onSubmit={(event) => void saveShipping(event)}>
        <h3>Địa chỉ nhận hàng</h3>
        {addressFields.map(([key, label]) => <label key={key} className="field-wrap">{label}<input className="field" required value={shipping[key]} onChange={(event) => setShipping((value) => ({ ...value, [key]: event.target.value }))} /></label>)}
        <GhnLocationSelect value={ghn} errors={ghnErrors} disabled={busy} onChange={(next) => { setGhn(next); setGhnErrors({}); }} />
        <button className="button button-secondary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu địa chỉ và tính phí"}</button>
      </form>}
      {payable && order.data.totalAmount !== null && <><button type="button" className="button button-primary" disabled={busy} onClick={() => void pay()}>{busy ? "Đang xử lý…" : order.data.totalAmount === 0 ? "Xác nhận thanh toán" : "Thanh toán bằng Ví Nexus"}</button>{order.data.totalAmount > 0 && <ButtonLink href={ROUTES.buyer.topUp} variant="secondary">Nạp tiền</ButtonLink>}</>}
      {status === "PAID" && <p role="status">Đã thanh toán phần còn lại. Tiền cọc đang được đối soát trước khi người bán tiếp nhận{order.data.sellerRespondDeadlineAt ? ` trước ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.data.sellerRespondDeadlineAt))}` : ""}.</p>}
      {canTrack && (
        <div style={{ marginTop: 14 }}>
          <TrackingCodeBar
            carrierCode={effectiveCarrierCode}
            carrierName={timeline.data?.carrierName}
            trackingCode={effectiveTrackingCode}
          />
          <ShipmentTimelineList
            events={timeline.data?.timeline ?? []}
            loading={timeline.loading}
            refreshing={timeline.loading}
            onRefresh={() => {
              order.reload();
              timeline.reload();
            }}
            title="Hành trình giao hàng đấu giá"
          />
        </div>
      )}
      {["SHIPPED", "DELIVERED"].includes(status ?? "") && <div className="auction-receipt"><p>Chỉ xác nhận sau khi bạn thực sự nhận hàng.</p>{confirmReceipt && <p role="alert">Xác nhận sẽ hoàn tất đơn và bắt đầu giải ngân cho người bán.</p>}<button type="button" className="button button-primary" disabled={busy} onClick={() => confirmReceipt ? void receive() : setConfirmReceipt(true)}>{confirmReceipt ? "Xác nhận đã nhận hàng" : "Tôi đã nhận hàng"}</button>{confirmReceipt && <button type="button" className="button button-secondary" onClick={() => setConfirmReceipt(false)}>Quay lại</button>}</div>}
      {deadlinePassed && status === "PENDINGPAYMENT" && <p role="status">Đã quá hạn thanh toán.</p>}
      {status === "COMPLETED" && <PartnerReviewCard referenceType="Auction" referenceId={orderId} title="Đánh giá người bán" counterpart="người bán" />}
      {status === "COMPLETED" && order.data.productId && <ProductReviewCard productId={order.data.productId} productName={order.data.productName} subOrderId={orderId} />}
    </>}
    {error && <p role="alert" className="notice">{error}</p>}{success && <p role="status" className="form-success">{success}</p>}
  </section>;
}
