/** Checks of the admin finance forms, mirroring the back end so a refusal is caught before the request is sent. */

export type FeeCheck = { ok: true; percent: number } | { ok: false; message: string };

/** Platform fee: a number from 0 to 100 (Commerce `UpdatePlatformFeeRequest`). Accepts a comma as the decimal mark. */
export function checkPlatformFee(input: string): FeeCheck {
  const text = input.trim().replace(",", ".");
  if (!text) return { ok: false, message: "Nhập tỷ lệ phí nền tảng." };
  if (!/^\d+(\.\d{1,4})?$/.test(text)) return { ok: false, message: "Nhập số từ 0 đến 100, tối đa 4 chữ số thập phân." };
  const percent = Number(text);
  if (percent < 0 || percent > 100) return { ok: false, message: "Tỷ lệ phải nằm trong khoảng 0% đến 100%." };
  return { ok: true, percent };
}

export type BudgetForm = { name: string; totalLimit: string; dailyLimit: string; perOrderCap: string; evidenceRef: string };
export type BudgetErrors = Partial<Record<keyof BudgetForm, string>>;
export const EMPTY_BUDGET_FORM: BudgetForm = { name: "", totalLimit: "", dailyLimit: "", perOrderCap: "", evidenceRef: "" };

function money(value: string): number | null {
  const text = value.trim().replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Wallet `CreateSubsidyBudgetCommand`: name up to 150, evidence up to 500, every limit above zero, `perOrder <= daily <= total`. */
export function validateBudgetForm(form: BudgetForm): BudgetErrors {
  const errors: BudgetErrors = {};
  if (!form.name.trim()) errors.name = "Nhập tên ngân sách.";
  else if (form.name.trim().length > 150) errors.name = "Tên tối đa 150 ký tự.";
  const total = money(form.totalLimit);
  const daily = money(form.dailyLimit);
  const perOrder = money(form.perOrderCap);
  if (total === null) errors.totalLimit = "Nhập tổng ngân sách là số nguyên lớn hơn 0.";
  if (daily === null) errors.dailyLimit = "Nhập hạn mức mỗi ngày là số nguyên lớn hơn 0.";
  if (perOrder === null) errors.perOrderCap = "Nhập hạn mức mỗi đơn là số nguyên lớn hơn 0.";
  if (total !== null && daily !== null && daily > total) errors.dailyLimit = "Hạn mức mỗi ngày không được lớn hơn tổng ngân sách.";
  if (daily !== null && perOrder !== null && perOrder > daily) errors.perOrderCap = "Hạn mức mỗi đơn không được lớn hơn hạn mức mỗi ngày.";
  if (!form.evidenceRef.trim()) errors.evidenceRef = "Nhập mã chứng từ nguồn tiền (ví dụ số lệnh chuyển khoản).";
  else if (form.evidenceRef.trim().length > 500) errors.evidenceRef = "Mã chứng từ tối đa 500 ký tự.";
  return errors;
}

export function toBudgetRequest(form: BudgetForm) {
  return {
    name: form.name.trim(),
    totalLimit: money(form.totalLimit) as number,
    dailyLimit: money(form.dailyLimit) as number,
    perOrderCap: money(form.perOrderCap) as number,
    evidenceRef: form.evidenceRef.trim(),
  };
}

export type BudgetRow = { status: string; createdByAdminId: string };

/**
 * Who may press Approve: the budget must be pending and the viewer must not be the one who created it. The back end enforces the same
 * (`SUBSIDY_APPROVER_MUST_DIFFER`); hiding the button only saves a refused request.
 */
export function canApproveBudget(row: BudgetRow, viewerId: string | null | undefined): boolean {
  return row.status.replace(/[^a-z]/gi, "").toUpperCase() === "PENDINGAPPROVAL" && Boolean(viewerId) && row.createdByAdminId.toLowerCase() !== String(viewerId).toLowerCase();
}

export function canCloseBudget(row: BudgetRow): boolean {
  return row.status.replace(/[^a-z]/gi, "").toUpperCase() === "ACTIVE";
}

/** Share of the total limit that is reserved plus used, as 0 to 100. */
export function budgetUsagePercent(total: number, reserved: number, used: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round(((reserved + used) / total) * 100)));
}
