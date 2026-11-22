import { describeError, formatError } from "@/lib/errors/error-messages";
import type { AuctionResult } from "./types";

/**
 * Selling below the reserve price. After an auction ends with a top bid under the reserve, the seller has 12 hours to accept or decline.
 * A server that sends `settlement.awaitingSellerApproval` names this state. An older one does not (the phase stays AWAITING_WINNER_PAYMENT and no
 * order exists yet), so the choice is then offered when that is what the result shows, and the server decides: it answers
 * NOT_AWAITING_SELLER_APPROVAL when the choice is not open.
 */
export function mayAnswerBelowReserve(result: Pick<AuctionResult, "status" | "phase" | "hasWinner" | "settlement" | "orderId">): boolean {
  // The server says so itself (for the seller and staff) once it sends the flag; otherwise fall back to what the result shows.
  if (typeof result.settlement?.awaitingSellerApproval === "boolean") {
    return String(result.status ?? "").toUpperCase() === "ENDED" && result.settlement.awaitingSellerApproval;
  }
  return String(result.status ?? "").toUpperCase() === "ENDED"
    && result.phase.toUpperCase() === "AWAITING_WINNER_PAYMENT"
    && !result.orderId
    && (!result.settlement || result.settlement.settlementStatus.toUpperCase() === "PENDING");
}

/** What declining costs the seller, by the number of declines in a row (the third one locks the reserve price for 14 days). */
export function declineConsequence(consecutiveDeclines: number | null | undefined): string {
  const next = (consecutiveDeclines ?? 0) + 1;
  if (next >= 3) return `Đây sẽ là lần từ chối thứ ${next} liên tiếp: quyền đặt giá sàn của bạn bị khóa 14 ngày.`;
  if (next === 2) return "Đây sẽ là lần từ chối thứ 2 liên tiếp. Lần thứ 3 sẽ khóa quyền đặt giá sàn 14 ngày.";
  return "Đây là lần từ chối đầu tiên. Từ chối 3 lần liên tiếp sẽ khóa quyền đặt giá sàn 14 ngày.";
}

export function describeReserveApprovalFailure(cause: unknown): string {
  return formatError(describeError(cause, { operation: "write" }));
}

/** The answer after accepting or declining, in words. */
export function describeReserveAnswer(accepted: boolean, response: { consecutiveDeclineCount: number; reserveRestrictedUntil: string | null }): string {
  if (accepted) return "Bạn đã đồng ý bán dưới giá sàn. Người thắng sẽ nhận hướng dẫn thanh toán.";
  if (response.reserveRestrictedUntil) return "Bạn đã từ chối. Quyền đặt giá sàn của bạn bị khóa 14 ngày.";
  return `Bạn đã từ chối bán dưới giá sàn (lần ${response.consecutiveDeclineCount} liên tiếp).`;
}
