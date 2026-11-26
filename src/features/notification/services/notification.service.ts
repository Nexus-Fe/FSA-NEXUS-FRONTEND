import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { NotificationItem, NotificationPage } from "../types";

export const notificationsChangedEvent = "nexus:notifications-changed";

let followUpTimers: number[] = [];

/** Notifies mounted notification bells/inboxes to refresh. Use `withFollowUp` after async outbox actions like order payment. */
export function notifyNotificationsChanged(withFollowUp = false): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(notificationsChangedEvent));
  if (!withFollowUp) return;

  for (const timer of followUpTimers) window.clearTimeout(timer);
  followUpTimers = [1500, 4000].map((delayMs) =>
    window.setTimeout(() => {
      window.dispatchEvent(new Event(notificationsChangedEvent));
    }, delayMs),
  );
}

export const notificationService = {
  getNotifications: async (page = 1, pageSize = 20, isRead?: boolean, signal?: AbortSignal) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (isRead !== undefined) query.set("isRead", String(isRead));
    return unwrap(await api.get<ApiResponse<NotificationPage> | NotificationPage>(
      `/api/v1/notifications/me?${query}`, { signal },
    ));
  },
  getUnreadCount: async (signal?: AbortSignal) => {
    const data = unwrap(await api.get<ApiResponse<{ unreadCount: number }> | { unreadCount: number }>(
      "/api/v1/notifications/me/unread-count",
      { signal },
    ));
    return data.unreadCount ?? 0;
  },
  markAsRead: (id: string) =>
    api.patch<ApiResponse<NotificationItem> | NotificationItem>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllAsRead: (notificationIds?: string[]) =>
    api.patch<ApiResponse<unknown> | unknown>(
      "/api/v1/notifications/me/read",
      notificationIds?.length ? { notificationIds } : {},
    ),
};
