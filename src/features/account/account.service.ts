import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { asList, type ActiveSession, type PreferenceRow, type ReputationHistoryRow, type ReputationPolicy } from "./account-rules";

export type SellerStatusSnapshot = {
  status?: string | null;
  rejectionReason?: string | null;
  nextStep?: string | null;
  businessEmail?: string | null;
};

export const accountService = {
  async sessions(signal?: AbortSignal): Promise<ActiveSession[]> {
    return asList<ActiveSession>(unwrap(await api.get<unknown>("/api/v1/me/sessions?page=1&pageSize=50", { signal })));
  },
  async revokeSession(id: string) {
    await api.delete<unknown>(`/api/v1/me/sessions/${encodeURIComponent(id)}`);
  },
  async logoutAll() {
    return api.post<unknown>("/api/v1/auth/logout-all", {});
  },
  async preferences(signal?: AbortSignal): Promise<PreferenceRow[]> {
    return asList<PreferenceRow>(unwrap(await api.get<unknown>("/api/v1/notifications/preferences", { signal })));
  },
  async savePreferences(preferences: Array<{ notificationType: string; channelCode: string; isDisabled: boolean }>) {
    return api.put<unknown>("/api/v1/notifications/preferences", { preferences });
  },
  async uploadSellerDocuments(files: { front: File; back: File; license?: File | null }, registrationId?: string) {
    const form = new FormData();
    form.append("frontCccd", files.front);
    form.append("backCccd", files.back);
    if (files.license) form.append("businessLicense", files.license);
    if (registrationId) form.append("registrationId", registrationId);
    return unwrap(await api.post<unknown>("/api/v1/sellers/registration/documents", form));
  },
  async reputationPolicy(signal?: AbortSignal): Promise<ReputationPolicy> {
    return unwrap(await api.get<ReputationPolicy>("/api/v1/reputation/policy", { signal }));
  },
  async reputationHistory(userId: string, page: number, signal?: AbortSignal): Promise<ReputationHistoryRow[]> {
    return asList<ReputationHistoryRow>(unwrap(await api.get<unknown>(`/api/v1/users/${encodeURIComponent(userId)}/reputation/history?page=${page}&pageSize=20`, { signal })));
  },
  async sellerStatus(signal?: AbortSignal): Promise<SellerStatusSnapshot | null> {
    try {
      return unwrap(await api.get<ApiResponse<SellerStatusSnapshot> | SellerStatusSnapshot>("/api/v1/sellers/status", { signal }));
    } catch {
      return null;
    }
  },
};
