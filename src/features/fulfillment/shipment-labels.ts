import { SHIPMENT_STATUS, SUB_ORDER_STATUS, isKnownStatus, normalizeStatus, statusLabel } from "@/lib/status-labels";

/**
 * Wording for a status on a shipment timeline. The timeline mixes the carrier's shipment statuses (`InTransit`, `[Returning]`) with the
 * sub-order's own (`Confirmed`, `Cancelled`), so both central tables are tried. An unknown status is shown as the server sent it.
 */
export function shipmentStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  if (isKnownStatus(SHIPMENT_STATUS, status)) return statusLabel(SHIPMENT_STATUS, status);
  if (isKnownStatus(SUB_ORDER_STATUS, status)) return statusLabel(SUB_ORDER_STATUS, status);
  return status;
}

/** How many delivery attempts failed, from a list of events that each carry a status. */
export function countFailedAttempts(events: ReadonlyArray<{ status: string }> | null | undefined): number {
  if (!events) return 0;
  return events.filter((event) => normalizeStatus(event.status) === "DELIVERYFAILED" || normalizeStatus(event.status) === "DELIVERYATTEMPTFAILED").length;
}

/** An order part has a shipment to follow once the seller has accepted it; before that, and after a refusal or cancellation, there is none. */
export function hasShipmentToTrack(subOrderStatus: string | null | undefined): boolean {
  if (!subOrderStatus) return false;
  const key = normalizeStatus(subOrderStatus);
  return !["PENDINGPAYMENT", "PAID", "PENDINGCONFIRMATION", "CANCELLED", "SELLERREJECTED"].includes(key);
}

export type ReturnBanner = "returning" | "returned" | null;

/** From the LAST timeline step: the parcel is on its way back to the seller, or has arrived. Nothing is said about money here. */
export function returnBanner(events: ReadonlyArray<{ status: string }> | null | undefined): ReturnBanner {
  const last = events && events.length > 0 ? normalizeStatus(events[events.length - 1].status) : "";
  if (last === "RETURNING") return "returning";
  if (last === "RETURNED") return "returned";
  return null;
}

export function shipmentStatusTone(status?: string | null): "green" | "amber" | "sky" | "red" | "slate" {
  if (!status) return "slate";
  const key = normalizeStatus(status);
  if (key === "DELIVERED") return "green";
  if (["PICKED", "HANDEDOVER", "INTRANSIT", "SHIPPING", "SHIPPED", "TRANSPORTING", "SORTING"].includes(key)) return "sky";
  if (["READYTOPICK", "PICKING", "PACKED", "CONFIRMED"].includes(key)) return "amber";
  if (["DELIVERYFAILED", "DELIVERYATTEMPTFAILED", "RETURNING", "RETURNED", "CANCELLED"].includes(key)) return "red";
  return "slate";
}
