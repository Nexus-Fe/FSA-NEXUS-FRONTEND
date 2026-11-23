import { api, unwrap, type ApiResponse } from "@/lib/api/client";

type Envelope<T> = ApiResponse<T> | T;
type Pagination = { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };

/** Commerce `PlatformFeeResponse`. The fee applies to wallet orders only; cash on delivery stays at `codPercent`. */
export type PlatformFee = { defaultPercent: number; updatedByRole: string; updatedAt: string; appliesTo: string; codPercent: number };

/** Wallet `SubsidyBudgetResult`. */
export type SubsidyBudget = {
  id: string;
  name: string;
  totalLimit: number;
  dailyLimit: number;
  perOrderCap: number;
  evidenceRef: string;
  status: string;
  createdByAdminId: string;
  approvedByAdminId?: string | null;
  approvedAt?: string | null;
  reservedAmount: number;
  usedAmount: number;
  availableAmount: number;
  createdAt: string;
};

export type SubsidyBudgetPage = { items: SubsidyBudget[]; pagination: Pagination };

export const financeService = {
  async platformFee(signal?: AbortSignal): Promise<PlatformFee> {
    return unwrap(await api.get<Envelope<PlatformFee>>("/api/v1/admin/platform-fee", { signal }));
  },
  async updatePlatformFee(defaultPercent: number): Promise<PlatformFee> {
    return unwrap(await api.put<Envelope<PlatformFee>>("/api/v1/admin/platform-fee", { defaultPercent }));
  },
  async budgets(page = 1, pageSize = 20, signal?: AbortSignal): Promise<SubsidyBudgetPage> {
    const raw = unwrap(await api.get<Envelope<SubsidyBudgetPage>>(`/api/v1/admin/wallets/subsidy-budgets?page=${page}&pageSize=${pageSize}`, { signal }));
    if (!raw || !Array.isArray(raw.items) || !raw.pagination) throw new Error("Dữ liệu ngân sách không đúng định dạng.");
    return raw;
  },
  async createBudget(input: { name: string; totalLimit: number; dailyLimit: number; perOrderCap: number; evidenceRef: string }): Promise<SubsidyBudget> {
    return unwrap(await api.post<Envelope<SubsidyBudget>>("/api/v1/admin/wallets/subsidy-budgets", input));
  },
  async approveBudget(id: string): Promise<SubsidyBudget> {
    return unwrap(await api.post<Envelope<SubsidyBudget>>(`/api/v1/admin/wallets/subsidy-budgets/${encodeURIComponent(id)}/approve`, {}));
  },
  async closeBudget(id: string): Promise<SubsidyBudget> {
    return unwrap(await api.post<Envelope<SubsidyBudget>>(`/api/v1/admin/wallets/subsidy-budgets/${encodeURIComponent(id)}/close`, {}));
  },
};
