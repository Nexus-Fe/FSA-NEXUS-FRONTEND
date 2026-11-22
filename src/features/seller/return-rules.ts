import { normalizeStatus } from "@/lib/status-labels";

/**
 * Seller confirms that a returned parcel is back (`POST /api/v1/seller/orders/{subOrderId}/confirm-return`, Fulfillment). The path says
 * "orders" but the id is the SUB-ORDER id. Stock is restored once; a repeat answers success with code `ALREADY_RETURNED` and adds nothing.
 */
const RETURN_STATES = new Set(["DELIVERYFAILED", "RETURNING", "RETURNED"]);

/** The button is offered when the last step of the timeline is a failed delivery or a return; the back end checks the same. */
export function canConfirmReturn(timeline: ReadonlyArray<{ status: string }> | null | undefined): boolean {
  if (!timeline || timeline.length === 0) return false;
  return RETURN_STATES.has(normalizeStatus(timeline[timeline.length - 1].status));
}

export type ConfirmReturnResponse = { success?: boolean; code?: string; message?: string; data?: { orderId?: string; restoredStock?: number } };

/** What the seller reads after the call. The back end's own message is not shown. */
export function describeConfirmReturn(response: ConfirmReturnResponse | null | undefined): { text: string; restored: boolean } {
  const code = String(response?.code ?? "").toUpperCase();
  if (code === "ALREADY_RETURNED") return { text: "Đơn này đã được xác nhận hoàn trước đó. Tồn kho không bị cộng thêm.", restored: false };
  const count = response?.data?.restoredStock;
  if (typeof count === "number") return { text: `Đã xác nhận hàng hoàn và cộng lại ${count} sản phẩm vào tồn kho.`, restored: true };
  return { text: "Đã xác nhận hàng hoàn.", restored: true };
}
