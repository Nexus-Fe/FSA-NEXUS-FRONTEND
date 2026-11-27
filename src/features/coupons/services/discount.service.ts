import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type DiscountScopeType = "System" | "Shop" | "Product";
export type DiscountType = "Percentage" | "FixedAmount";
export type DiscountStatus = "Draft" | "Active" | "Inactive" | "Expired";
export type DiscountScope = { id?: string; scopeRefType: string; scopeRefId?: string | null };
export type DiscountSummary = {
  id: string; code: string; name: string; scopeType: DiscountScopeType; ownerSellerId?: string | null;
  discountType: DiscountType; discountValue: number; minOrderAmount: number; maxDiscountAmount?: number | null;
  maxUsesTotal?: number | null; maxUsesPerUser?: number; usedCount: number; reservedCount: number;
  isVisible: boolean; status: DiscountStatus; startsAt?: string | null; endsAt?: string | null;
  scopes?: DiscountScope[];
};
export type AvailableVoucher = Pick<DiscountSummary, "id" | "code" | "name" | "scopeType" | "ownerSellerId" | "discountType" | "discountValue" | "minOrderAmount" | "maxDiscountAmount" | "startsAt" | "endsAt"> & { isEligible: boolean; ineligibleReason?: string | null; estimatedDiscountAmount: number };
export type DiscountPage<T> = { items: T[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasNextPage: boolean } };
export type CreateDiscountInput = {
  code: string; name: string; scopeType: DiscountScopeType; ownerSellerId?: string | null;
  discountType: DiscountType; discountValue: number; minOrderAmount: number; maxDiscountAmount?: number | null;
  maxUsesTotal?: number | null; maxUsesPerUser: number; isVisible: boolean; startsAt?: string | null;
  endsAt?: string | null; scopes?: Array<{ scopeRefType: string; scopeRefId?: string | null }>;
};
export type UpdateDiscountInput = Pick<DiscountSummary, "name" | "isVisible" | "maxUsesPerUser" | "maxUsesTotal" | "endsAt">;
export type ValidateVoucherResponse = {
  isValid: boolean;
  discountId?: string | null;
  code?: string | null;
  scopeType?: DiscountScopeType | null;
  estimatedDiscountAmount: number;
  ineligibleReason?: string | null;
  message?: string | null;
  ownerSellerId?: string | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
};
export type RecommendVouchersResponse = { recommendedVoucherCodes: string[]; savingsBreakdown: { productDiscount: number; shopDiscount: number; systemDiscount: number; totalSavings: number } };

function page<T>(raw: DiscountPage<T>): DiscountPage<T> {
  if (!raw || !Array.isArray(raw.items) || !raw.pagination || typeof raw.pagination.totalCount !== "number") throw new Error("Dữ liệu mã giảm giá không đúng định dạng.");
  return raw;
}

export const discountService = {
  async list(filters: { page?: number; pageSize?: number; scopeType?: string; status?: string; search?: string } = {}, signal?: AbortSignal) {
    const query = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 20) });
    if (filters.scopeType) query.set("scopeType", filters.scopeType);
    if (filters.status) query.set("status", filters.status);
    if (filters.search) query.set("search", filters.search);
    return page(unwrap(await api.get<ApiResponse<DiscountPage<DiscountSummary>> | DiscountPage<DiscountSummary>>(`/api/v1/discounts?${query}`, { signal })));
  },
  async get(id: string) { return unwrap(await api.get<ApiResponse<DiscountSummary> | DiscountSummary>(`/api/v1/discounts/${encodeURIComponent(id)}`)); },
  async create(input: CreateDiscountInput) { return unwrap(await api.post<ApiResponse<DiscountSummary> | DiscountSummary>("/api/v1/discounts", input)); },
  async update(id: string, input: UpdateDiscountInput) { return unwrap(await api.put<ApiResponse<DiscountSummary> | DiscountSummary>(`/api/v1/discounts/${encodeURIComponent(id)}`, input)); },
  async setStatus(id: string, status: DiscountStatus) { return unwrap(await api.patch<ApiResponse<DiscountSummary> | DiscountSummary>(`/api/v1/discounts/${encodeURIComponent(id)}/status`, { status })); },
  async remove(id: string) { await api.delete(`/api/v1/discounts/${encodeURIComponent(id)}`); },
  async available(cartItemIds: string[], signal?: AbortSignal) {
    const query = new URLSearchParams({ cartItemIds: cartItemIds.join(","), page: "1", pageSize: "100" });
    return page(unwrap(await api.get<ApiResponse<DiscountPage<AvailableVoucher>> | DiscountPage<AvailableVoucher>>(`/api/v1/discounts/available?${query}`, { signal })));
  },
  async validate(code: string, cartItemIds: string[]) { return unwrap(await api.post<ApiResponse<ValidateVoucherResponse> | ValidateVoucherResponse>("/api/v1/discounts/validate", { code, cartItemIds })); },
  async recommend(cartItemIds: string[], paymentMethod?: "Wallet" | "Cod") {
    return unwrap(
      await api.post<ApiResponse<RecommendVouchersResponse> | RecommendVouchersResponse>(
        "/api/v1/discounts/recommend",
        paymentMethod ? { cartItemIds, paymentMethod } : { cartItemIds },
      ),
    );
  },
};
