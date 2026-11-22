/** Issues the cart validation (`POST /carts/me/validate`) can report, and what the buyer reads for each. */
export type CartIssue = {
  cartItemId: string;
  skuId: string;
  issueType: string;
  message?: string;
  oldPrice?: number | null;
  newPrice?: number | null;
  availableStock?: number | null;
  requestedQuantity?: number | null;
  suggestedQuantity?: number | null;
};

export type CartValidation = { isValid: boolean; hasPriceChanges: boolean; hasStockIssues: boolean; issues: CartIssue[] };

const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";

/** One sentence per issue. The back end's English `message` is never shown. */
export function describeCartIssue(issue: CartIssue, productName: string): string {
  switch (issue.issueType) {
    case "PRODUCT_NOT_FOUND": return `${productName} không còn tồn tại. Hãy xóa khỏi giỏ hàng.`;
    case "PRODUCT_INACTIVE": return `${productName} hiện không bán. Hãy xóa khỏi giỏ hàng.`;
    case "OUT_OF_STOCK": return `${productName} đã hết hàng.`;
    case "INSUFFICIENT_STOCK":
      return issue.availableStock != null
        ? `${productName} chỉ còn ${issue.availableStock} sản phẩm${issue.requestedQuantity != null ? ` (bạn chọn ${issue.requestedQuantity})` : ""}.`
        : `${productName} không đủ hàng cho số lượng đã chọn.`;
    case "PRICE_CHANGED":
      return issue.oldPrice != null && issue.newPrice != null
        ? `Giá ${productName} đã đổi từ ${money(issue.oldPrice)} thành ${money(issue.newPrice)}.`
        : `Giá ${productName} đã thay đổi.`;
    default: return `${productName} có thay đổi cần xem lại.`;
  }
}

/** The buyer may go on only when the back end says the cart is valid. A price rise is shown and must be confirmed again. */
export function canContinueToCheckout(validation: CartValidation | null): boolean {
  return Boolean(validation && validation.isValid);
}

export function normalizeValidation(raw: unknown): CartValidation {
  const value = (raw ?? {}) as Partial<CartValidation> & { issues?: unknown };
  return {
    isValid: Boolean(value.isValid),
    hasPriceChanges: Boolean(value.hasPriceChanges),
    hasStockIssues: Boolean(value.hasStockIssues),
    issues: Array.isArray(value.issues) ? (value.issues as CartIssue[]) : [],
  };
}
