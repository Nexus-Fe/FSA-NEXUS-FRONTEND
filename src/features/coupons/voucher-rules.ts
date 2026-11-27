import type { AvailableVoucher } from "./services/discount.service";

export function canSelectVoucher(selected: AvailableVoucher[], candidate: AvailableVoucher): string | null {
  if (selected.some((item) => item.code === candidate.code)) return null;
  if (candidate.scopeType === "System" && selected.some((item) => item.scopeType === "System")) return "Chỉ chọn một mã toàn sàn.";
  if (candidate.scopeType !== "System" && selected.some((item) => item.scopeType !== "System" && item.ownerSellerId === candidate.ownerSellerId)) return "Mỗi gian hàng chỉ dùng một mã gian hàng hoặc sản phẩm.";
  return null;
}
