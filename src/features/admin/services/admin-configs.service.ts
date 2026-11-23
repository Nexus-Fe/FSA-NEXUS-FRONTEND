import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type SystemConfigItem = {
  key: string;
  value: string;
  description?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  dataType: string;
  updatedAt?: string;
};

export type PagedConfigsPayload = {
  items?: SystemConfigItem[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
};

export type UpdateConfigPayload = {
  key: string;
  value: string;
  reason?: string;
};

export type ConfigListPage = {
  items: SystemConfigItem[];
  total: number;
};

export const adminConfigsService = {
  async history(key: string, signal?: AbortSignal): Promise<Array<{ id: string; oldValue?: string | null; newValue?: string | null; reason?: string | null; changedBy?: string | null; changedAt: string }>> {
    const result = unwrap(await api.get<ApiResponse<Array<{ id: string; oldValue?: string | null; newValue?: string | null; reason?: string | null; changedBy?: string | null; changedAt: string }>> | Array<{ id: string; oldValue?: string | null; newValue?: string | null; reason?: string | null; changedBy?: string | null; changedAt: string }>>(`/api/v1/admin/configs/${encodeURIComponent(key)}/history?page=1&pageSize=50`, { signal }));
    // The server answers a page `{ items, pagination }`; a bare array is accepted too.
    const rows = Array.isArray(result) ? result : (result as { items?: unknown } | null)?.items;
    return Array.isArray(rows) ? rows : [];
  },
  async list(page: number, pageSize: number = 50, signal?: AbortSignal): Promise<ConfigListPage> {
    const res = await api.get<ApiResponse<PagedConfigsPayload> | PagedConfigsPayload>(
      `/api/v1/admin/configs?page=${page}&pageSize=${pageSize}`,
      { signal },
    );
    const payload = unwrap(res);
    if (Array.isArray(payload)) {
      return { items: payload as SystemConfigItem[], total: payload.length };
    }
    if (payload && typeof payload === "object") {
      const obj = payload as PagedConfigsPayload;
      const items = Array.isArray(obj.items) ? obj.items : [];
      const total = obj.pagination?.totalCount ?? items.length;
      return { items, total };
    }
    return { items: [], total: 0 };
  },

  async update(payload: UpdateConfigPayload): Promise<void> {
    await api.put("/api/v1/admin/configs", {
      key: payload.key.trim(),
      value: payload.value,
      reason: payload.reason?.trim() || undefined,
    });
  },
};
