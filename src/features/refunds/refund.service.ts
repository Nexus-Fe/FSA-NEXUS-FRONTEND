import { api, unwrap } from "@/lib/api/client";
import { asRefundPage, type RefundPage } from "./refund-rules";

export const refundService = {
  async list(page: number, status: string, signal?: AbortSignal): Promise<RefundPage> {
    const query = `?page=${page}&pageSize=20${status ? `&status=${encodeURIComponent(status)}` : ""}`;
    return asRefundPage(unwrap(await api.get<unknown>(`/api/v1/refunds${query}`, { signal })));
  },
  async approve(id: string, note?: string) {
    return api.post<unknown>(`/api/v1/refunds/${encodeURIComponent(id)}/approve`, note ? { note } : {});
  },
  async reject(id: string, reason: string) {
    return api.post<unknown>(`/api/v1/refunds/${encodeURIComponent(id)}/reject`, { reason });
  },
};
