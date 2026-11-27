import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type AdminProductReviewItem = {
  id: string;
  productId: string;
  buyerId: string;
  rating: number;
  comment?: string | null;
  reviewImages?: string[] | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type AdminReviewListQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  rating?: number;
  productId?: string;
  buyerId?: string;
  sortBy?: "createdAt" | "rating";
  sortDirection?: "asc" | "desc";
};

export type AdminReviewListPage = {
  items: AdminProductReviewItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type RawPage = {
  items: AdminProductReviewItem[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export type ModerateReviewPayload = {
  action: "HIDE" | "PUBLISH";
  reason?: string;
};

const basePath = "/api/v1/admin/reviews";

export const reviewModerationService = {
  async list(query: AdminReviewListQuery = {}, signal?: AbortSignal): Promise<AdminReviewListPage> {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 20),
    });
    if (query.status) params.set("status", query.status);
    if (query.rating) params.set("rating", String(query.rating));
    if (query.productId?.trim()) params.set("productId", query.productId.trim());
    if (query.buyerId?.trim()) params.set("buyerId", query.buyerId.trim());
    if (query.sortBy) params.set("sortBy", query.sortBy);
    if (query.sortDirection) params.set("sortDirection", query.sortDirection);

    const payload = unwrap(await api.get<ApiResponse<RawPage> | RawPage>(`${basePath}?${params}`, { signal }));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const total = payload?.pagination?.totalCount ?? items.length;
    const page = payload?.pagination?.pageIndex ?? (query.page ?? 1);
    const pageSize = payload?.pagination?.pageSize ?? (query.pageSize ?? 20);
    const totalPages = payload?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

    return { items, total, page, pageSize, totalPages };
  },

  async moderate(reviewId: string, payload: ModerateReviewPayload): Promise<AdminProductReviewItem> {
    return unwrap(
      await api.patch<ApiResponse<AdminProductReviewItem> | AdminProductReviewItem>(
        `${basePath}/${encodeURIComponent(reviewId)}/moderate`,
        payload,
      ),
    );
  },
};
