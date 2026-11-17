import { ApiError } from "@/lib/api/client";
import type { AuctionResult } from "./types";

const PHASE_LABELS: Record<string, string> = {
  AWAITING_WINNER_PAYMENT: "Chờ người thắng thanh toán",
  SECOND_CHANCE_OFFERED: "Đang mời người về nhì",
  AWAITING_RUNNER_UP_PAYMENT: "Chờ người về nhì thanh toán",
  WINNER_PAID_AWAITING_SELLER: "Đã thanh toán, chờ người bán tiếp nhận",
  SETTLED: "Đã hoàn tất",
  FAILED: "Phiên không thành công",
  NO_BIDS_FAILED: "Phiên không có lượt đặt giá",
  CANCELLED: "Phiên đã hủy",
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Đang xác nhận",
  AUTHORIZED: "Đang giữ",
  CAPTURED: "Đã tính vào đơn",
  RELEASED: "Đã hoàn lại",
  FAILED: "Chưa giữ được",
  EXPIRED: "Đã hết hạn",
};

const OFFER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ phản hồi",
  OFFERED: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  DECLINED: "Đã từ chối",
  EXPIRED: "Đã hết hạn",
  CANCELLED: "Đã hủy",
};

const label = (labels: Record<string, string>, value: string | null | undefined) =>
  value ? labels[value.toUpperCase()] ?? value : "—";

export const phaseLabel = (phase: string | null | undefined) => label(PHASE_LABELS, phase);
export const depositStatusLabel = (status: string | null | undefined) => label(DEPOSIT_STATUS_LABELS, status);
export const offerStatusLabel = (status: string | null | undefined) => label(OFFER_STATUS_LABELS, status);

/** Phases in which a buyer currently holds the right to buy. BE moves winnerId to the runner-up once they accept. */
const BUYING_PHASES = new Set(["AWAITING_WINNER_PAYMENT", "AWAITING_RUNNER_UP_PAYMENT", "WINNER_PAID_AWAITING_SELLER", "SETTLED"]);

export type AuctionOutcome = {
  /** The viewer holds the right to buy and should see the order and payment. */
  won: boolean;
  /** The viewer won first but the right moved on because they did not pay in time. */
  lostRight: boolean;
  /** The viewer has a second-chance offer to answer. */
  hasOffer: boolean;
  title: string;
  nextStep: string;
};

/** What happened to the viewer's own deposit, from its real status. Never assume it was returned. */
function depositNote(result: AuctionResult, won: boolean): string {
  const status = result.myDeposit?.status.toUpperCase();
  switch (status) {
    case undefined: return "";
    case "AUTHORIZED": return " Khoản cọc của bạn vẫn đang được giữ cho tới khi phiên chốt người mua.";
    case "PENDING": return " Khoản cọc của bạn đang được xác nhận.";
    case "RELEASED": return " Khoản cọc của bạn đã được hoàn lại vào Ví Nexus.";
    // A buyer who still holds the right pays with the deposit; anyone else lost it for not paying in time.
    case "CAPTURED": return won ? " Khoản cọc đã được trừ vào đơn hàng." : " Khoản cọc đã bị khấu trừ theo chính sách vì quá hạn thanh toán.";
    default: return "";
  }
}

/** Label for the viewer's deposit status. A capture means payment for the buyer holding the right, a forfeit for anyone else. */
export function myDepositLabel(status: string | null | undefined, won: boolean) {
  return status?.toUpperCase() === "CAPTURED" && !won ? "Đã bị khấu trừ" : depositStatusLabel(status);
}

/**
 * Reads the result as the viewer sees it. BE hides winnerId from other buyers, so a missing winnerId means
 * "not you", never "no winner": whether a winner exists comes from the public phase.
 */
export function describeOutcome(result: AuctionResult, userId: string | null | undefined): AuctionOutcome {
  const phase = result.phase.toUpperCase();
  const isNamedWinner = Boolean(userId && result.winnerId && result.winnerId === userId);
  const won = isNamedWinner && BUYING_PHASES.has(phase);
  // The first winner who did not pay: still named while the runner-up is invited, then only their captured deposit shows it.
  const lostRight = !won && ((isNamedWinner && phase === "SECOND_CHANCE_OFFERED") || result.myDeposit?.status.toUpperCase() === "CAPTURED");
  const hasOffer = Boolean(userId && result.secondChance?.bidderId === userId && result.secondChance.status.toUpperCase() === "OFFERED");
  const note = depositNote(result, won);
  const outcome = (title: string, nextStep: string): AuctionOutcome => ({ won, lostRight, hasOffer, title, nextStep: (nextStep + note).trim() });

  if (won) return outcome("Bạn đã thắng phiên này", "");
  if (lostRight) return outcome(
    phase === "SECOND_CHANCE_OFFERED" ? "Quyền mua đã chuyển cho người về nhì" : "Bạn đã mất quyền mua sản phẩm này",
    "Đơn thắng đấu giá đã quá hạn thanh toán, nên hệ thống đã mời người đặt giá kế tiếp hoặc đóng phiên.");
  if (hasOffer) return outcome("Bạn được mời mua sản phẩm này", "Người thắng trước không hoàn tất. Hãy phản hồi lời mời trước hạn trong mục lời mời.");

  switch (phase) {
    case "NO_BIDS_FAILED": return outcome("Phiên không có lượt đặt giá", "Phiên kết thúc mà không có ai đặt giá.");
    case "FAILED": return outcome("Phiên không thành công", "Không có người mua hoàn tất thanh toán cho phiên này.");
    case "CANCELLED": return outcome("Phiên đã hủy", "Phiên đã bị hủy trước khi có người mua.");
    default: return outcome("Phiên đã có người thắng", "Bạn không thắng phiên này.");
  }
}

const DEPOSIT_ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_AVAILABLE_BALANCE: "Số dư khả dụng không đủ để giữ cọc. Hãy nạp tiền rồi thử lại.",
  WALLET_FROZEN: "Ví Nexus của bạn đang bị tạm khóa nên chưa thể giữ cọc. Hãy liên hệ hỗ trợ.",
  WALLET_NOT_FOUND: "Chưa tìm thấy Ví Nexus của bạn. Hãy mở trang Ví để kích hoạt ví rồi thử lại.",
  PAYER_NOT_ELIGIBLE: "Tài khoản của bạn hiện chưa đủ điều kiện đặt cọc cho phiên này.",
  DEPOSIT_TERMS_CHANGED: "Điều kiện cọc vừa thay đổi. Hãy xem lại số tiền cọc mới rồi xác nhận lại.",
  DEPOSIT_HOLD_NOT_ACTIVE: "Khoản giữ cọc trước đó đã đóng nên không thể dùng lại cho phiên này.",
  DEPOSIT_CLOSED: "Khoản cọc của bạn cho phiên này đã kết thúc.",
  DEPOSIT_RELEASE_PENDING: "Khoản cọc trước đó đang được hoàn lại. Hãy thử lại sau ít phút.",
  AUCTION_NOT_OPEN_FOR_DEPOSIT: "Phiên này không còn nhận đặt cọc.",
  BIDDER_RESTRICTED: "Tài khoản của bạn đang bị hạn chế tham gia đấu giá.",
  ACCOUNT_NOT_VERIFIED: "Hãy xác minh tài khoản trước khi tham gia đấu giá.",
};

export type DepositFailure = {
  message: string;
  /** Send the same Idempotency-Key again: the first request may still have locked the money. */
  keepKey: boolean;
  /** Show the top-up link. */
  needsTopUp: boolean;
  /** The terms shown are stale, so the requirement must be reloaded before confirming again. */
  reloadTerms: boolean;
};

export function describeDepositFailure(cause: unknown): DepositFailure {
  if (!(cause instanceof ApiError)) {
    // Network failure or timeout: the result is unknown, so the retry must reuse the key.
    return { message: "Chưa nhận được phản hồi khi giữ cọc. Hãy bấm Kiểm tra lại trước khi thử lần nữa.", keepKey: true, needsTopUp: false, reloadTerms: false };
  }
  const code = cause.errorCode?.toUpperCase() ?? "";
  if (cause.status >= 500 || cause.status === 0) {
    return { message: "Ví Nexus đang bận nên chưa xác nhận được khoản cọc. Hãy bấm Kiểm tra lại trước khi thử lần nữa.", keepKey: true, needsTopUp: false, reloadTerms: false };
  }
  return {
    message: DEPOSIT_ERROR_MESSAGES[code] ?? cause.message ?? "Không thể giữ cọc cho phiên này.",
    keepKey: false,
    needsTopUp: code === "INSUFFICIENT_AVAILABLE_BALANCE",
    reloadTerms: code === "DEPOSIT_TERMS_CHANGED",
  };
}
