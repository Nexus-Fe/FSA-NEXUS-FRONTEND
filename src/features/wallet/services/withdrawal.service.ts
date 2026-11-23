import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type {
  AdminWithdrawalPage,
  ProcessedWithdrawal,
  ProcessWithdrawalInput,
  WithdrawalAction,
  WithdrawalHistoryEntry,
  WithdrawalPage,
  WithdrawalRequest,
  WithdrawalResponse,
  WithdrawalSummary,
} from "../types";

type Envelope<T> = ApiResponse<T> | T;

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(name, String(value));
  }
  return search.toString();
}

export const withdrawalService = {
  /** Creates a request. The same Idempotency-Key with the same content returns the first request instead of locking the money again. */
  create: async (input: WithdrawalRequest, idempotencyKey: string): Promise<WithdrawalResponse> =>
    unwrap(await api.post<Envelope<WithdrawalResponse>>("/api/v1/wallets/withdrawals", input, { headers: { "Idempotency-Key": idempotencyKey } })),

  mine: async (page = 1, pageSize = 10, status?: string, signal?: AbortSignal): Promise<WithdrawalPage> =>
    unwrap(await api.get<Envelope<WithdrawalPage>>(`/api/v1/wallets/withdrawals?${query({ page, pageSize, status })}`, { signal })),

  get: async (id: string, signal?: AbortSignal): Promise<WithdrawalSummary> =>
    unwrap(await api.get<Envelope<WithdrawalSummary>>(`/api/v1/wallets/withdrawals/${encodeURIComponent(id)}`, { signal })),

  /** Seller cancels a request that is still Pending; the held money becomes available again. Not idempotent: a second call is refused by status. */
  cancel: async (id: string): Promise<WithdrawalSummary> =>
    unwrap(await api.post<Envelope<WithdrawalSummary>>(`/api/v1/wallets/withdrawals/${encodeURIComponent(id)}/cancel`, {})),

  adminList: async (page = 1, pageSize = 20, status?: string, signal?: AbortSignal): Promise<AdminWithdrawalPage> =>
    unwrap(await api.get<Envelope<AdminWithdrawalPage>>(`/api/v1/admin/wallets/withdrawals?${query({ page, pageSize, status })}`, { signal })),

  adminHistory: async (id: string, signal?: AbortSignal): Promise<WithdrawalHistoryEntry[]> =>
    unwrap(await api.get<Envelope<WithdrawalHistoryEntry[]>>(`/api/v1/admin/wallets/withdrawals/${encodeURIComponent(id)}/history`, { signal })),

  process: async (id: string, input: ProcessWithdrawalInput): Promise<ProcessedWithdrawal> =>
    unwrap(await api.patch<Envelope<ProcessedWithdrawal>>(`/api/v1/admin/wallets/withdrawals/${encodeURIComponent(id)}`, { ...input })),
};

export type StatusTone = "sky" | "green" | "amber" | "slate" | "red" | "indigo";

/** Words for the seller and staff. "Đã duyệt" is not "Đã chuyển tiền": approval takes the money from the wallet, the transfer comes after. */
export const WITHDRAWAL_STATUS: Record<string, { label: string; tone: StatusTone; hint: string }> = {
  Pending: { label: "Chờ duyệt", tone: "amber", hint: "Tiền đang được giữ trong ví, chờ staff duyệt." },
  Approved: { label: "Đã duyệt, chờ chuyển khoản", tone: "sky", hint: "Đã trừ khỏi ví. Staff sẽ chuyển khoản thủ công; chưa có nghĩa là tiền đã về tài khoản." },
  Processing: { label: "Đang chuyển khoản", tone: "indigo", hint: "Staff đã gửi lệnh chuyển khoản và đang chờ kết quả từ ngân hàng." },
  Completed: { label: "Đã chuyển tiền", tone: "green", hint: "Ngân hàng đã chuyển tiền vào tài khoản nhận." },
  Rejected: { label: "Bị từ chối", tone: "red", hint: "Yêu cầu bị từ chối, tiền đã trả lại khả dụng trong ví." },
  Failed: { label: "Chuyển khoản thất bại", tone: "red", hint: "Chuyển khoản không thành công, tiền đã được hoàn lại vào ví." },
  Cancelled: { label: "Đã hủy", tone: "slate", hint: "Bạn đã hủy yêu cầu, tiền đã trả lại khả dụng trong ví." },
};

/** Every state a request can be in, in the order staff filters show them. Staff and seller read the same table above. */
export const WITHDRAWAL_STATUS_ORDER = ["Pending", "Approved", "Processing", "Completed", "Rejected", "Failed", "Cancelled"] as const;

/** Only a request that nobody has started to process may still be cancelled by its owner. */
export function canCancelWithdrawal(status: string): boolean {
  return status.replace(/[^a-z]/gi, "").toUpperCase() === "PENDING";
}

export function withdrawalStatus(status: string) {
  return WITHDRAWAL_STATUS[status] ?? { label: status, tone: "slate" as StatusTone, hint: "" };
}

/** The decisions staff may still take on a request in each state, and which of them only an admin may take. */
export const WITHDRAWAL_ACTIONS: Record<string, { action: WithdrawalAction; label: string; adminOnly?: boolean }[]> = {
  Pending: [{ action: "Approve", label: "Duyệt" }, { action: "Reject", label: "Từ chối" }],
  Approved: [
    { action: "StartProcessing", label: "Đang chuyển khoản" },
    { action: "Complete", label: "Đã chuyển tiền" },
    { action: "Fail", label: "Chuyển thất bại" },
  ],
  Processing: [
    { action: "Complete", label: "Đã chuyển tiền" },
    { action: "ResolveFailed", label: "Xử lý thất bại", adminOnly: true },
  ],
};

export const WITHDRAWAL_HISTORY_LABEL: Record<string, string> = {
  Request: "Seller gửi yêu cầu",
  Approve: "Duyệt",
  Reject: "Từ chối",
  StartProcessing: "Bắt đầu chuyển khoản",
  Complete: "Xác nhận đã chuyển tiền",
  Fail: "Chuyển khoản thất bại, hoàn ví",
  ResolveFailed: "Admin xử lý thất bại, hoàn ví",
  Cancel: "Seller hủy yêu cầu",
  // The server sends the audit action name, for example "WithdrawalApprove"; the short names above are kept for older data.
  WithdrawalRequest: "Seller gửi yêu cầu",
  WithdrawalApprove: "Duyệt",
  WithdrawalReject: "Từ chối",
  WithdrawalStartProcessing: "Bắt đầu chuyển khoản",
  WithdrawalComplete: "Xác nhận đã chuyển tiền",
  WithdrawalFail: "Chuyển khoản thất bại, hoàn ví",
  WithdrawalResolveFailed: "Admin xử lý thất bại, hoàn ví",
  WithdrawalCancel: "Seller hủy yêu cầu",
};
