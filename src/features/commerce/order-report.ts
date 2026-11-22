import { normalizeStatus } from "@/lib/status-labels";

/**
 * Reporting a seller from an order. The server only accepts a report about a seller of an order the reporter bought and that was delivered
 * (the reference is the order or sub-order id), and Fraud or Counterfeit reports need at least one evidence file.
 */
const REPORTABLE = new Set(["DELIVERED", "COMPLETED"]);

export function canReportSubOrder(status: string | null | undefined): boolean {
  return REPORTABLE.has(normalizeStatus(status));
}

export function orderReportHref(subOrder: { subOrderId: string; sellerId: string }): string {
  const params = new URLSearchParams({ referenceType: "Order", referenceId: subOrder.subOrderId, reportedUserId: subOrder.sellerId });
  return `/buyer/reports?${params.toString()}`;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReportPrefill = { referenceType: "Order" | null; referenceId: string; reportedUserId: string };

/** Reads the link above. Anything that is not an order reference with two valid ids is ignored, so a hand-edited link cannot send junk. */
export function parseReportPrefill(params: { get(name: string): string | null }): ReportPrefill {
  const type = params.get("referenceType");
  const referenceId = (params.get("referenceId") ?? "").trim();
  const reportedUserId = (params.get("reportedUserId") ?? "").trim();
  if (type === "Order" && GUID.test(referenceId) && GUID.test(reportedUserId)) return { referenceType: "Order", referenceId, reportedUserId };
  return { referenceType: null, referenceId: "", reportedUserId: "" };
}

/** Fraud and Counterfeit order reports need evidence; the form says so before the server has to refuse. */
export function evidenceRequired(referenceType: "Order" | null, violationType: string, evidenceCount: number): boolean {
  return referenceType === "Order" && (violationType === "Fraud" || violationType === "Counterfeit") && evidenceCount === 0;
}
