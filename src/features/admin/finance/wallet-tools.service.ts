import { api, unwrap, type ApiResponse } from "@/lib/api/client";

type Envelope<T> = ApiResponse<T> | T;
export type Pagination = { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
export type Page<T> = { items: T[]; pagination: Pagination };

/** Wallet `WalletResponse` as listed for admin and staff. */
export type AdminWallet = { walletId: string; userId: string; balance: number; availableBalance: number; lockedBalance: number; currency: string; status: string; updatedAt: string };
/** Wallet `AdminHoldListItem`: an auction deposit hold. */
export type AdminHold = { holdId: string; walletId: string; ownerUserId: string; referenceType: string; referenceId: string; auctionId?: string | null; amount: number; status: string; createdAt: string; resolvedAt?: string | null };
/** Wallet `StripeReconciliationAttemptItem`: a payment stuck in ReconciliationRequired. */
export type StripeAttempt = { attemptId: string; purpose: string; ownerId: string; walletTopupId?: string | null; directPaymentOrderId?: string | null; amount: number; checkoutSessionId?: string | null; paymentIntentId?: string | null; status: string; blocksReplacement: boolean; createdAt: string; updatedAt: string };

function page<T>(raw: unknown, what: string): Page<T> {
  const value = raw as Page<T> | null;
  if (!value || !Array.isArray(value.items) || !value.pagination) throw new Error(`Dữ liệu ${what} không đúng định dạng.`);
  return value;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") search.set(key, String(value));
  return search.toString();
}

export const walletToolsService = {
  async wallets(filters: { page: number; pageSize?: number; status?: string; search?: string }, signal?: AbortSignal): Promise<Page<AdminWallet>> {
    return page(unwrap(await api.get<Envelope<Page<AdminWallet>>>(`/api/v1/admin/wallets?${query({ page: filters.page, pageSize: filters.pageSize ?? 20, status: filters.status, search: filters.search })}`, { signal })), "ví");
  },
  async holds(filters: { page: number; pageSize?: number; status?: string; userId?: string }, signal?: AbortSignal): Promise<Page<AdminHold>> {
    return page(unwrap(await api.get<Envelope<Page<AdminHold>>>(`/api/v1/admin/wallets/holds?${query({ page: filters.page, pageSize: filters.pageSize ?? 20, status: filters.status, userId: filters.userId })}`, { signal })), "khoản giữ");
  },
  async stripeAttempts(pageNumber: number, signal?: AbortSignal): Promise<Page<StripeAttempt>> {
    return page(unwrap(await api.get<Envelope<Page<StripeAttempt>>>(`/api/v1/admin/wallets/stripe/reconciliation-required?${query({ page: pageNumber, pageSize: 20 })}`, { signal })), "đối soát Stripe");
  },
  async resolveAttempt(attemptId: string, resolution: "Failed" | "Expired", reason: string): Promise<void> {
    await api.post(`/api/v1/admin/wallets/stripe/attempts/${encodeURIComponent(attemptId)}/resolve`, { resolution, reason });
  },
  async reconcilePending(): Promise<number> {
    const raw = unwrap(await api.post<Envelope<{ processedCount: number }>>("/api/v1/admin/wallets/stripe/reconcile-pending", {}));
    return Number(raw?.processedCount ?? 0);
  },
};

/** The reason the back end requires for resolving an attempt: 3 to 500 characters. */
export function validateResolveReason(reason: string): string | null {
  const text = reason.trim();
  if (text.length < 3) return "Nhập lý do xử lý (ít nhất 3 ký tự).";
  if (text.length > 500) return "Lý do tối đa 500 ký tự.";
  return null;
}
