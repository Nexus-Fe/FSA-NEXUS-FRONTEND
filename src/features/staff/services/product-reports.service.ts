import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type ProductReportItem = {
  id: string;
  productId: string;
  productName: string;
  productPrimaryImageUrl?: string | null;
  reason: string;
  description: string;
  status: string;
  resolutionNote?: string | null;
  evidenceImages: string[] | null;
  createdAt: string;
  reviewedAt?: string | null;
};

export type ProductReportPage = {
  items: ProductReportItem[];
  pagination: {
    pageIndex?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
    hasNextPage: boolean;
  };
};

export type ProductReportAction = "BAN_PRODUCT" | "DISMISS" | "INVESTIGATE";

export type ProductReportSearchQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  reason?: string;
};

const basePath = "/api/v1/admin/reports/products";

export const productReportsService = {
  async list(query: ProductReportSearchQuery = {}, signal?: AbortSignal): Promise<ProductReportPage> {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 20),
    });
    if (query.status) params.set("status", query.status);
    if (query.reason) params.set("reason", query.reason);

    const response = await api.get<ApiResponse<ProductReportPage> | ProductReportPage>(
      `${basePath}?${params}`,
      { signal },
    );
    return unwrap(response);
  },

  async moderate(id: string, action: ProductReportAction, resolutionNote: string): Promise<void> {
    await api.put(`${basePath}/${encodeURIComponent(id)}/action`, {
      action,
      resolutionNote,
    });
  },
};
