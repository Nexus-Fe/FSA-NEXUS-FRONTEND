/** Checks for a wallet-to-wallet transfer (`POST /api/v1/wallets/transfers`). The limits are the back end's. */
export const TRANSFER_MIN = 1_000;
export const TRANSFER_MAX = 100_000_000;

export type TransferForm = { recipientUserId: string; amount: string; note: string };
export type TransferErrors = Partial<Record<keyof TransferForm, string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whole dong only; thousands separators are accepted. Returns null for anything else. */
export function parseTransferAmount(text: string): number | null {
  const clean = text.trim().replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateTransfer(form: TransferForm, selfUserId: string | null | undefined): TransferErrors {
  const errors: TransferErrors = {};
  const recipient = form.recipientUserId.trim();
  if (!UUID.test(recipient) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(recipient)) errors.recipientUserId = "Nhập mã người nhận (UUID) hợp lệ.";
  else if (selfUserId && recipient.toLowerCase() === selfUserId.toLowerCase()) errors.recipientUserId = "Không thể chuyển tiền cho chính bạn.";
  const amount = parseTransferAmount(form.amount);
  if (amount === null) errors.amount = "Nhập số tiền là số nguyên.";
  else if (amount < TRANSFER_MIN || amount > TRANSFER_MAX) errors.amount = `Số tiền từ ${TRANSFER_MIN.toLocaleString("vi-VN")} đến ${TRANSFER_MAX.toLocaleString("vi-VN")} ₫.`;
  if (form.note.length > 500) errors.note = "Ghi chú tối đa 500 ký tự.";
  return errors;
}

export function toTransferRequest(form: TransferForm) {
  return { recipientUserId: form.recipientUserId.trim(), amount: parseTransferAmount(form.amount) as number, note: form.note.trim() || undefined };
}
