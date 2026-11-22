import { describeError, formatError } from "@/lib/errors/error-messages";

/** Rules for the optional reserve price and Buy Now price a seller may set. All amounts are VND with at most two decimals. */

export type AuctionPriceInput = { start: number; reserve?: number | null; buyNow?: number | null };

function validAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

/** Message for the first rule broken, or null. Only what the front end can know is checked; the server checks the rest. */
export function validateAuctionPrices(input: AuctionPriceInput): string | null {
  const { start, reserve, buyNow } = input;
  if (!validAmount(start)) return "Giá khởi điểm không hợp lệ.";
  if (reserve != null) {
    if (!validAmount(reserve)) return "Giá sàn không hợp lệ (không âm, tối đa 2 chữ số thập phân).";
    if (reserve < start) return "Giá sàn phải lớn hơn hoặc bằng giá khởi điểm.";
  }
  if (buyNow != null) {
    if (!validAmount(buyNow)) return "Giá mua ngay không hợp lệ (không âm, tối đa 2 chữ số thập phân).";
    if (reserve != null) {
      if (buyNow <= reserve) return "Giá mua ngay phải lớn hơn giá sàn.";
    } else if (buyNow <= start) {
      return "Giá mua ngay phải lớn hơn giá khởi điểm.";
    }
  }
  return null;
}

/** Empty text means "not set". Returns NaN for text that is not a number so the validator reports it. */
export function parseOptionalAmount(text: string): number | null {
  const value = text.trim();
  return value === "" ? null : Number(value);
}

const PRICE_CODES = new Set(["VAL_INVALID_PRICE", "INVALID_PRICE_RELATION", "RESERVE_PRICE_RESTRICTED"]);

/** Text for a refused price, or null when the failure is about something else. */
export function describeAuctionPriceFailure(cause: unknown): string | null {
  const described = describeError(cause, { operation: "write" });
  return described.code && PRICE_CODES.has(described.code) ? formatError(described) : null;
}

export function reserveRestrictionText(restrictedUntil: string | null | undefined): string {
  const when = restrictedUntil ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(restrictedUntil)) : "";
  return `Bạn bị tạm khóa đặt giá sàn${when ? ` đến ${when}` : ""}.`;
}
