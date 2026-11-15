import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { DepositRequest, ResumeTopupResponse, TopupPage, TopupResponse, TopupStatus, WalletBalance, WalletTransactionPage, WithdrawalRequest, WithdrawalResponse } from "../types";

export const walletService = {
  async getBalance(signal?: AbortSignal): Promise<WalletBalance> {
    const response = await api.get<ApiResponse<WalletBalance> | WalletBalance>("/api/v1/wallets/me", { signal });
    return "data" in response ? response.data : response;
  },
  async getTransactions(signal?: AbortSignal): Promise<WalletTransactionPage> {
    const response = await api.get<ApiResponse<WalletTransactionPage> | WalletTransactionPage>("/api/v1/wallets/transactions?page=1&pageSize=10", { signal });
    return "data" in response ? response.data : response;
  },
  deposit: async (input: DepositRequest, idempotencyKey: string): Promise<TopupResponse> =>
    unwrap(await api.post<ApiResponse<TopupResponse> | TopupResponse>("/api/v1/wallets/topups/stripe", input, { headers: { "Idempotency-Key": idempotencyKey } })),
  topupStatus: async (id: string, signal?: AbortSignal): Promise<TopupStatus> =>
    unwrap(await api.get<ApiResponse<TopupStatus> | TopupStatus>(`/api/v1/wallets/topups/${encodeURIComponent(id)}`, { signal })),
  topups: async (page = 1, pageSize = 10, signal?: AbortSignal): Promise<TopupPage> =>
    unwrap(await api.get<ApiResponse<TopupPage> | TopupPage>(`/api/v1/wallets/topups?page=${page}&pageSize=${pageSize}`, { signal })),
  resumeTopup: async (id: string): Promise<ResumeTopupResponse> =>
    unwrap(await api.post<ApiResponse<ResumeTopupResponse> | ResumeTopupResponse>(`/api/v1/wallets/topups/${encodeURIComponent(id)}/resume`, {})),
  withdraw: async (input: WithdrawalRequest): Promise<WithdrawalResponse> =>
    unwrap(await api.post<ApiResponse<WithdrawalResponse> | WithdrawalResponse>("/api/v1/wallets/withdrawals", input)),
  createDirectCheckout: (input: { orderId: string; amount: number; gateway: "VNPAY"; bankCode?: string; returnUrl: string }) =>
    api.post<ApiResponse<{ transactionId: string; orderId: string; amount: number; paymentUrl: string; status: string }>>("/api/v1/wallets/checkout/direct", input),
};
