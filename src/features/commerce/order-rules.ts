import { normalizeStatus } from "@/lib/status-labels";

/**
 * When the order screen offers repay, complete and change-address. The rules mirror `OrderService` in Commerce; the back end
 * still decides, so a button shown here can still be refused and the refusal is explained from the error dictionary.
 */

export type RulesOrder = { status: string; paymentDeadlineAt?: string | null };
export type RulesSubOrder = { status: string; paymentMethod?: string | null };

const key = (status: string | null | undefined) => normalizeStatus(status);

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
