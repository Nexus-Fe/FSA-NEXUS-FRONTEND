import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { DepositRequest, ResumeTopupResponse, TopupPage, TopupResponse, TopupStatus, WalletBalance, WalletHoldPage, WalletTransactionPage } from "../types";

export const walletService = {
  async getBalance(signal?: AbortSignal): Promise<WalletBalance> {
    const response = await api.get<ApiResponse<WalletBalance> | WalletBalance>("/api/v1/wallets/me", { signal });
    return "data" in response ? response.data : response;
  },
  async getTransactions(signal?: AbortSignal): Promise<WalletTransactionPage> {
    const response = await api.get<ApiResponse<WalletTransactionPage> | WalletTransactionPage>("/api/v1/wallets/transactions?page=1&pageSize=10", { signal });
    return "data" in response ? response.data : response;
  },
  async getHolds(signal?: AbortSignal): Promise<WalletHoldPage> {
    return unwrap(await api.get<ApiResponse<WalletHoldPage> | WalletHoldPage>("/api/v1/wallets/me/holds?status=Held&page=1&pageSize=50", { signal }));
  },
  deposit: async (input: DepositRequest, idempotencyKey: string): Promise<TopupResponse> =>
    unwrap(await api.post<ApiResponse<TopupResponse> | TopupResponse>("/api/v1/wallets/topups/stripe", input, { headers: { "Idempotency-Key": idempotencyKey } })),
  topupStatus: async (id: string, signal?: AbortSignal): Promise<TopupStatus> =>
    unwrap(await api.get<ApiResponse<TopupStatus> | TopupStatus>(`/api/v1/wallets/topups/${encodeURIComponent(id)}`, { signal })),
  topups: async (page = 1, pageSize = 10, signal?: AbortSignal, status?: string): Promise<TopupPage> => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) query.set("status", status);
    return unwrap(await api.get<ApiResponse<TopupPage> | TopupPage>(`/api/v1/wallets/topups?${query}`, { signal }));
  },
  resumeTopup: async (id: string): Promise<ResumeTopupResponse> =>
    unwrap(await api.post<ApiResponse<ResumeTopupResponse> | ResumeTopupResponse>(`/api/v1/wallets/topups/${encodeURIComponent(id)}/resume`, {})),
  createDirectCheckout: (input: { orderId: string; amount: number; gateway: "VNPAY"; bankCode?: string; returnUrl: string }) =>
    api.post<ApiResponse<{ transactionId: string; orderId: string; amount: number; paymentUrl: string; status: string }>>("/api/v1/wallets/checkout/direct", input),
};
