import { formatMoney } from "@/lib/presentation";
import { myDepositLabel, offerStatusLabel, phaseLabel } from "./auction-outcome";
import type { AuctionResult } from "./types";

const SETTLEMENT_LABELS: Record<string, string> = {
  PENDING: "Đang tạo đơn",
  PENDINGPAYMENT: "Chờ thanh toán",
  AWAITINGPAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán, chờ người bán xác nhận",
  CONFIRMED: "Chờ lấy hàng",
  SELLERACCEPTED: "Chờ lấy hàng",
  SHIPPING: "Đang giao hàng",
  SHIPPED: "Đang giao hàng",
  DELIVERED: "Đã giao hàng",
  EXPIRED: "Quá hạn thanh toán",
  FAILED: "Thanh toán thất bại",
  CANCELLED: "Đã hủy",
  CANCELED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  REFUNDED: "Đã hoàn tiền",
  RETURNING: "Đang hoàn hàng",
  RETURNED: "Đã hoàn hàng",
};
export const auctionOrderStatusLabel = (status: string) => SETTLEMENT_LABELS[status.replace(/[^a-z]/gi, "").toUpperCase()] ?? status;

export function AuctionResultExtras({ result, showPrivate = false, won = false, orderStatus }: { result: AuctionResult; showPrivate?: boolean; won?: boolean; orderStatus?: string }) {
  const actualOrderStatus = orderStatus?.replace(/[^a-z]/gi, "").toUpperCase();
  const orderClosed = actualOrderStatus === "CANCELLED" || actualOrderStatus === "CANCELED" || actualOrderStatus === "EXPIRED" || actualOrderStatus === "REFUNDED";
  return <>
    <div className="info-row"><span>Giai đoạn</span><strong>{orderClosed ? "Đơn đã kết thúc" : phaseLabel(result.phase)}</strong></div>
    {result.myDeposit && <div className="info-row"><span>Cọc của bạn</span><strong className="tabular-nums">{formatMoney(result.myDeposit.amount)} · {myDepositLabel(result.myDeposit.status, won)}</strong></div>}
    {showPrivate && (result.settlement || orderStatus) && <>
      {!orderClosed && result.settlement && <><div className="info-row"><span>Cọc được trừ vào đơn</span><strong className="tabular-nums">{formatMoney(result.settlement.depositAmount)}</strong></div>
        <div className="info-row"><span>Còn cần thanh toán (chưa gồm phí giao hàng)</span><strong className="tabular-nums">{formatMoney(result.settlement.remainingAmount)}</strong></div></>}
      <div className="info-row"><span>Trạng thái đơn</span><strong>{auctionOrderStatusLabel(orderStatus ?? result.settlement?.settlementStatus ?? "")}</strong></div>
    </>}
    {showPrivate && result.secondChance && <div className="info-row"><span>Lời mời người về nhì</span><strong>{offerStatusLabel(result.secondChance.status)}{result.secondChance.respondBy ? ` · hạn ${new Date(result.secondChance.respondBy).toLocaleString("vi-VN")}` : ""}</strong></div>}
  </>;
}
