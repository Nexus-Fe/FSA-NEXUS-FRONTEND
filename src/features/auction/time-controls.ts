import { api, unwrap, type ApiResponse } from "@/lib/api/client";

/**
 * Request builders for the QA time controls (`PATCH /api/v1/admin/auctions/{id}/schedule` and `.../settlement-deadlines`).
 * Both routes exist only where the back end has `AdminTimeControls:Enabled` on and is not Production; otherwise they answer 404.
 * Rules mirror `AdminUpdateScheduleAsync`: only a Draft, Scheduled or Running auction; remaining seconds from 0; a start time cannot be set on a running auction.
 */
export type TimeAction =
  | { kind: "open-now" }
  | { kind: "end-now" }
  | { kind: "remaining"; seconds: number }
  | { kind: "seller-approval-expired" }
  | { kind: "payment-expired" }
  | { kind: "second-chance-expired" };

export type TimeRequest = { path: "schedule" | "settlement-deadlines"; body: Record<string, unknown> };

const SCHEDULE_STATUSES = new Set(["DRAFT", "SCHEDULED", "RUNNING"]);

export function actionAllowed(action: TimeAction, auctionStatus: string): boolean {
  const status = auctionStatus.replace(/[^a-z]/gi, "").toUpperCase();
  switch (action.kind) {
    case "open-now": return status === "SCHEDULED" || status === "DRAFT";
    case "end-now":
    case "remaining": return status === "RUNNING";
    default: return status === "ENDED" || status === "SETTLED" || status === "FAILED" || status === "RUNNING" || status === "SCHEDULED";
  }
}

/** Returns the call to make for an action, or an error text when the input is not valid. */
export function buildTimeRequest(action: TimeAction, reason: string, now: Date = new Date()): TimeRequest | { error: string } {
  const why = reason.trim();
  if (why.length < 3) return { error: "Nhập lý do (ít nhất 3 ký tự) để thao tác được ghi lại." };
  switch (action.kind) {
    case "open-now": return { path: "schedule", body: { scheduledStartAt: now.toISOString(), reason: why } };
    case "end-now": return { path: "schedule", body: { remainingSeconds: 0, reason: why } };
    case "remaining":
      if (!Number.isInteger(action.seconds) || action.seconds < 0 || action.seconds > 86_400) return { error: "Số giây phải là số nguyên từ 0 đến 86.400." };
      return { path: "schedule", body: { remainingSeconds: action.seconds, reason: why } };
    case "seller-approval-expired": return { path: "settlement-deadlines", body: { sellerApprovalRemainingSeconds: 0, reason: why } };
    case "payment-expired": return { path: "settlement-deadlines", body: { paymentRemainingSeconds: 0, reason: why } };
    case "second-chance-expired": return { path: "settlement-deadlines", body: { winnerOfferRemainingSeconds: 0, reason: why } };
  }
}

export function isScheduleStatus(status: string): boolean {
  return SCHEDULE_STATUSES.has(status.replace(/[^a-z]/gi, "").toUpperCase());
}

export const timeControlsService = {
  async apply(auctionId: string, request: TimeRequest): Promise<unknown> {
    return unwrap(await api.patch<ApiResponse<unknown> | unknown>(`/api/v1/admin/auctions/${encodeURIComponent(auctionId)}/${request.path}`, request.body));
  },
};
