import { describeError, formatError } from "@/lib/errors/error-messages";

/**
 * Rules and wording for Buy Now. Buy Now LOCKS the goods price in the buyer's wallet; it is not yet a payment, and the wording says so.
 * Pure, so it is tested without the screen.
 */

export type BuyNowFailure = {
  message: string;
  /** The request may have reached the server. The same Idempotency-Key is kept and the buyer checks before trying again. */
  unknownOutcome: boolean;
  needsTopUp: boolean;
  /** The auction changed under the buyer: reload it before anything else. */
  reload: boolean;
};

const RELOAD_CODES = new Set(["CONCURRENT_UPDATE", "BUY_NOW_NOT_AVAILABLE", "AUCTION_NOT_RUNNING"]);
const TOP_UP_CODES = new Set(["INSUFFICIENT_AVAILABLE_BALANCE", "INSUFFICIENT_BALANCE", "INSUFFICIENT_WALLET_BALANCE", "BUY_NOW_HOLD_FAILED", "DEPOSIT_HOLD_NOT_ACTIVE"]);

export function describeBuyNowFailure(cause: unknown): BuyNowFailure {
  const described = describeError(cause, { operation: "write" });
  const code = described.code ?? "";
  return {
    message: formatError(described),
    // A busy wallet or server may have locked the money before failing, so the result is unknown whatever else is said.
    unknownOutcome: described.kind === "unknown-outcome",
    needsTopUp: TOP_UP_CODES.has(code),
    reload: RELOAD_CODES.has(code),
  };
}

/** Buy Now is offered only while the server says it is available, and never to the seller of the auction. */
export function canOfferBuyNow(input: { buyNowAvailable?: boolean; buyNowPriceAmount?: number | null; status: string; sellerId: string; userId?: string | null; canBid: boolean }): boolean {
  return Boolean(input.buyNowAvailable && input.buyNowPriceAmount && input.status.toUpperCase() === "RUNNING" && input.canBid && input.userId && input.userId !== input.sellerId);
}

/** The line shown after a successful Buy Now. The goods money is locked and the shipping fee is still to pay, so nothing here says "paid". */
export function buyNowSuccessText(): string {
  return "Tiền hàng đã được khóa trong ví; còn bước thanh toán phí giao hàng.";
}

export function buyNowConfirmText(amountText: string): string {
  return `Hệ thống sẽ khóa ${amountText} tiền hàng trong ví của bạn (đã gồm cọc nếu có). Đây chưa phải thanh toán: sau đó bạn nhập địa chỉ và trả phí giao hàng trong 24 giờ.`;
}
