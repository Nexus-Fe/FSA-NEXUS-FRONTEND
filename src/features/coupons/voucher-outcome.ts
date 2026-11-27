import { describeError, formatError } from "@/lib/errors/error-messages";

/** Text for a failed voucher call (validate, recommend, list). The back end's own wording is never shown. */
export function describeVoucherFailure(cause: unknown): string {
  return formatError(describeError(cause, { operation: "read" }));
}

/** Reason codes of `rejectedVouchers[].reasonCode` in the quote response (the full list the back end documents). */
const REJECTION_LABELS: Record<string, string> = {
  NOT_FOUND: "Không tìm thấy mã.",
  NOT_ACTIVE: "Mã đang tạm dừng.",
  NOT_STARTED: "Mã chưa đến thời gian áp dụng.",
  EXPIRED: "Mã đã hết hạn.",
  USAGE_LIMIT_REACHED: "Mã đã hết lượt sử dụng.",
  USER_LIMIT_REACHED: "Bạn đã dùng hết lượt của mã này.",
  MIN_ORDER_NOT_MET: "Đơn hàng chưa đạt giá trị tối thiểu của mã.",
  SCOPE_MISMATCH: "Mã không áp dụng cho sản phẩm hoặc gian hàng trong giỏ.",
  EVALUATION_FAILED: "Không kiểm tra được mã lúc này.",
};

export function describeRejectedVoucher(reasonCode?: string | null): string {
  return (reasonCode && REJECTION_LABELS[reasonCode.toUpperCase()]) || "Mã không áp dụng được cho giỏ hàng này.";
}

/**
 * `ineligibleReason` of the available-vouchers and validate calls is free English text taken from the back end's warnings
 * (for example "Minimum order amount not met."), not a code. Known phrases are translated; anything else gets a neutral sentence.
 */
export function ineligibleText(reason?: string | null): string {
  if (!reason) return "Chưa đủ điều kiện dùng mã này.";
  const code = reason.trim().toUpperCase();
  if (code === "VOUCHER_OUT_OF_STOCK") return "Mã giảm giá đã hết lượt sử dụng.";
  if (code === "VOUCHER_USAGE_LIMIT_EXCEEDED" || code === "VOUCHER_USER_LIMIT_EXCEEDED") {
    return "Bạn đã dùng hết số lượt cho phép của mã này.";
  }
  const text = reason.toLowerCase();
  if (text.includes("minimum")) return "Đơn hàng chưa đạt giá trị tối thiểu của mã.";
  if (text.includes("expired")) return "Mã đã hết hạn.";
  if (text.includes("usage limit for this voucher") || text.includes("user")) {
    return "Bạn đã dùng hết số lượt cho phép của mã này.";
  }
  if (text.includes("limit") || text.includes("out_of_stock")) return "Mã đã hết lượt sử dụng.";
  return "Chưa đủ điều kiện dùng mã này.";
}

export type VoucherFormInput = {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  startsAt?: string | null;
  endsAt?: string | null;
  maxUsesTotal?: number | null;
  maxUsesPerUser: number;
};

/** Checks the create form before it is sent. Returns the first problem, or null when the input is fine. */
export function validateVoucherForm(input: VoucherFormInput): string | null {
  if (!input.code.trim() || !input.name.trim()) return "Nhập mã và tên chương trình.";
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) return "Giá trị giảm phải lớn hơn 0.";
  if (input.discountType === "Percentage" && input.discountValue > 100) return "Tỷ lệ giảm không được quá 100%.";
  if (!Number.isInteger(input.maxUsesPerUser) || input.maxUsesPerUser < 1) return "Giới hạn mỗi người phải từ 1 trở lên.";
  if (input.maxUsesTotal != null && (!Number.isInteger(input.maxUsesTotal) || input.maxUsesTotal < 1)) return "Tổng lượt dùng phải từ 1 trở lên.";
  if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) return "Ngày kết thúc phải sau ngày bắt đầu.";
  return null;
}
