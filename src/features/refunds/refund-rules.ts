/** Commerce refunds (`GET /api/v1/refunds`, `POST /refunds/{id}/approve|reject`). Buyer reads; seller, admin and staff decide only while the refund is `Requested` (waiting for a decision). `WalletPending` means it was decided and waits for the wallet, so it is no longer decidable. */
export type RefundRow = {
  id: string; subOrderId: string; subOrderNo: string; buyerId: string; sellerId: string; amount: number;
  reason: string; status: string; sellerNote: string | null; rejectReason: string | null; requestedAt: string; completedAt: string | null;
};
export type RefundPage = { items: RefundRow[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } };

export const REFUND_FILTERS = [["", "Tất cả"], ["Requested", "Chờ xử lý"], ["WalletPending", "Chờ ví xác nhận"], ["Completed", "Đã hoàn tiền"], ["Rejected", "Bị từ chối"], ["Failed", "Thất bại"]] as const;
export const MAX_REJECT_REASON = 500;

export function canDecideRefund(role: "buyer" | "seller" | "admin" | "staff", status: string): boolean {
  return role !== "buyer" && status.toLowerCase() === "requested";
}

/** The reject reason is required by the server. Returns the trimmed text or an error text. */
export function parseRejectReason(text: string): { value: string } | { error: string } {
  const value = text.trim();
  if (!value) return { error: "Nhập lý do từ chối để người mua biết." };
  if (value.length > MAX_REJECT_REASON) return { error: `Lý do tối đa ${MAX_REJECT_REASON} ký tự.` };
  return { value };
}

/** The refund page may arrive enveloped; anything unusable becomes an empty page. */
export function asRefundPage(value: unknown): RefundPage {
  const raw = ((value as { data?: unknown } | null)?.data ?? value) as Partial<RefundPage> | null;
  const items = Array.isArray(raw?.items) ? (raw!.items as RefundRow[]) : [];
  const p = raw?.pagination;
  return { items, pagination: { pageIndex: p?.pageIndex ?? 1, pageSize: p?.pageSize ?? items.length, totalCount: p?.totalCount ?? items.length, totalPages: p?.totalPages ?? 1, hasPreviousPage: Boolean(p?.hasPreviousPage), hasNextPage: Boolean(p?.hasNextPage) } };
}
