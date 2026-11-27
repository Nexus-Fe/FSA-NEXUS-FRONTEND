import type { AvailableVoucher } from "./services/discount.service";

export type VoucherSelectionCandidate = Pick<AvailableVoucher, "code" | "scopeType"> & {
  ownerSellerId?: string | null;
};

export function canSelectVoucher(
  selected: VoucherSelectionCandidate[],
  candidate: VoucherSelectionCandidate,
): string | null {
  const normalizedCode = candidate.code.toUpperCase();
  if (selected.some((item) => item.code.toUpperCase() === normalizedCode)) return null;
  if (candidate.scopeType === "System" && selected.some((item) => item.scopeType === "System")) {
    return "Chỉ chọn tối đa 1 mã giảm giá toàn sàn.";
  }
  if (candidate.scopeType !== "System") {
    const hasConflict = selected.some((item) => {
      if (item.scopeType === "System") return false;
      if (item.ownerSellerId && candidate.ownerSellerId) {
        return item.ownerSellerId.toLowerCase() === candidate.ownerSellerId.toLowerCase();
      }
      return !item.ownerSellerId || !candidate.ownerSellerId;
    });
    if (hasConflict) {
      return "Mỗi gian hàng chỉ chọn 1 mã (sản phẩm hoặc shop).";
    }
  }
  return null;
}
