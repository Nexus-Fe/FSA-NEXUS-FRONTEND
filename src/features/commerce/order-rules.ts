import { normalizeStatus } from "@/lib/status-labels";

/**
 * When the order screen offers repay, complete and change-address. The rules mirror `OrderService` in Commerce; the back end
 * still decides, so a button shown here can still be refused and the refusal is explained from the error dictionary.
 */

export type RulesOrder = { status: string; paymentDeadlineAt?: string | null };
export type RulesSubOrder = { status: string; paymentMethod?: string | null };

const key = (status: string | null | undefined) => normalizeStatus(status);

export function isCodPaymentMethod(method: string | null | undefined): boolean {
  return (method ?? "").trim().toUpperCase() === "COD";
}

export function describeBuyerOrderStatus(status: string, paymentMethod?: string | null): string {
  const k = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (k === "PENDINGPAYMENT" && isCodPaymentMethod(paymentMethod)) return "Chờ người bán xác nhận (COD)";
  if (k === "SELLERREJECTED" && isCodPaymentMethod(paymentMethod)) return "Đã bị từ chối";
  return (
    (
      {
        PENDINGPAYMENT: "Chờ thanh toán",
        PAID: "Đã thanh toán · Đã chuyển đến Seller",
        PENDINGCONFIRMATION: "Chờ người bán xác nhận",
        CONFIRMED: "Đơn hàng đã được khởi tạo thành công",
        SELLERACCEPTED: "Đơn hàng đã được khởi tạo thành công",
        SHIPPING: "Đang giao hàng",
        SHIPPED: "Đang giao hàng",
        DELIVERED: "Đã giao hàng · Chờ xác nhận nhận hàng",
        COMPLETED: "Đã nhận hàng · Hoàn tất",
        SELLERREJECTED: "Đã bị từ chối · Đã hoàn tiền",
        CANCELLED: "Đã hủy",
        REFUNDED: "Đã hoàn tiền",
      } as Record<string, string>
    )[k] ?? status
  );
}

/** `RepayOrderAsync`: only an order in PendingPayment, before its deadline, and not cash on delivery. */
export function canRepay(order: RulesOrder, subOrders: readonly RulesSubOrder[], now: number): boolean {
  if (key(order.status) !== "PENDINGPAYMENT") return false;
  const deadline = order.paymentDeadlineAt ? Date.parse(order.paymentDeadlineAt) : NaN;
  if (!Number.isFinite(deadline) || deadline <= now) return false;
  return !subOrders.some((sub) => key(sub.paymentMethod) === "COD");
}

/**
 * `CompleteOrderAsync`: not cancelled or expired, and every sub-order that is not cancelled is Delivered or Completed.
 * An order that is already Completed has nothing left to complete.
 */
export function canCompleteOrder(order: RulesOrder, subOrders: readonly RulesSubOrder[]): boolean {
  const status = key(order.status);
  if (status === "CANCELLED" || status === "EXPIRED" || status === "COMPLETED") return false;
  const active = subOrders.filter((sub) => key(sub.status) !== "CANCELLED");
  if (active.length === 0) return false;
  if (!active.every((sub) => ["DELIVERED", "COMPLETED"].includes(key(sub.status)))) return false;
  return active.some((sub) => key(sub.status) !== "COMPLETED");
}

/** `ChangeSubOrderShippingAddressAsync`: refused once shipping has started or the sub-order is finished. */
export function canChangeAddress(sub: RulesSubOrder): boolean {
  return ["PENDINGPAYMENT", "PAID", "CONFIRMED", "SELLERACCEPTED"].includes(key(sub.status));
}

/** Money text for the dialog that asks to confirm a changed shipping fee. */
export function describeFeeChange(oldFee: number, newFee: number): "same" | "up" | "down" {
  if (newFee > oldFee) return "up";
  if (newFee < oldFee) return "down";
  return "same";
}
