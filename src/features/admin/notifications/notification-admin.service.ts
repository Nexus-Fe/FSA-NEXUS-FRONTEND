import { api, unwrap } from "@/lib/api/client";
import { asPage, type Channel, type Delivery, type DeliveryLog, type PageOf, type Template } from "./notification-admin-rules";

const root = "/api/v1/admin/notifications";
const qs = (filter: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
};

export const notificationAdminService = {
  async templates(filter: { page: number; code?: string; channel?: string }, signal?: AbortSignal): Promise<PageOf<Template>> {
    return asPage(unwrap(await api.get<unknown>(`${root}/templates?${qs({ ...filter, pageSize: 20 })}`, { signal })));
  },
  async updateTemplate(id: string, body: { expectedUpdatedAt: string; subjectTemplate: string; bodyTemplate: string; isMandatory: boolean; isActive: boolean }) {
    return api.put<unknown>(`${root}/templates/${encodeURIComponent(id)}`, body);
  },
  async channels(signal?: AbortSignal): Promise<PageOf<Channel>> {
    return asPage(unwrap(await api.get<unknown>(`${root}/channels?page=1&pageSize=50`, { signal })));
  },
  async updateChannel(code: string, body: { name: string; isDisabled: boolean; expectedUpdatedAt: string }) {
    return api.put<unknown>(`${root}/channels/${encodeURIComponent(code)}`, body);
  },
  async deliveries(filter: { page: number; channel?: string; status?: string; userId?: string }, signal?: AbortSignal): Promise<PageOf<Delivery>> {
    return asPage(unwrap(await api.get<unknown>(`${root}/deliveries?${qs({ ...filter, pageSize: 20 })}`, { signal })));
  },
  async logs(id: string, signal?: AbortSignal): Promise<PageOf<DeliveryLog>> {
    return asPage(unwrap(await api.get<unknown>(`${root}/deliveries/${encodeURIComponent(id)}/logs?page=1&pageSize=50`, { signal })));
  },
  async retry(id: string, body: { requestId: string; expectedRowVersion: number; reason: string }) {
    return api.post<unknown>(`${root}/deliveries/${encodeURIComponent(id)}/retries`, body);
  },
};
