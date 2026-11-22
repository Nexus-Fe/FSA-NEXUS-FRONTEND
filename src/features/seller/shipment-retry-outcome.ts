import { describeError, formatError } from "@/lib/errors/error-messages";

/** What the seller is told when asking the carrier for a new shipment of an accepted order fails. */
export type ShipmentRetryFailure = {
  message: string;
  /** Where the seller can fix the cause: the warehouse form, or nothing to do but wait. */
  fix: "warehouse-form" | "contact-support" | "none";
};

export function describeShipmentRetryFailure(cause: unknown): ShipmentRetryFailure {
  const described = describeError(cause, { operation: "write" });
  const fix: ShipmentRetryFailure["fix"] =
    described.code === "SELLER_WAREHOUSE_INCOMPLETE" ? "warehouse-form" : described.code === "SELLER_WAREHOUSE_MISSING" ? "contact-support" : "none";
  return { message: formatError(described), fix };
}

/** The "tạo lại vận đơn" button shows for an accepted order that has no tracking code yet. */
export function needsShipmentRetry(currentStatus: string | null | undefined, trackingCode: string | null | undefined): boolean {
  if (trackingCode && trackingCode.trim()) return false;
  const key = String(currentStatus ?? "").replace(/[^a-z]/gi, "").toUpperCase();
  return ["CONFIRMED", "SELLERACCEPTED", "PROCESSING"].includes(key);
}
