"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { Card, PageHeading } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { usePathname } from "next/navigation";
import { NotificationAction } from "./NotificationAction";
import { notificationService, notificationsChangedEvent } from "./services/notification.service";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotificationsScreen() {
  const { user } = useSession();
  const viewer = usePathname()?.startsWith("/seller") ? "seller" : "buyer";
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const resource = useApiResource(user?.id ? `notifications:${user.id}:${page}:${unreadOnly}` : null,
    (signal) => notificationService.getNotifications(page, 20, unreadOnly ? false : undefined, signal));

  async function markRead(id: string) {
    setBusyId(id);
    setActionError("");
    try {
      await notificationService.markAsRead(id);
      resource.reload();
      window.dispatchEvent(new Event(notificationsChangedEvent));
    } catch (error) {
      setActionError(formatError(describeError(error, { operation: "write" })));
    } finally {
      setBusyId(null);
    }
  }

  return <>
    <PageHeading title="Thông báo" description="Cập nhật về tài khoản, gian hàng và đơn hàng của bạn." />
    <div className="notification-toolbar">
      <label htmlFor="notification-filter">Hiển thị</label>
      <select id="notification-filter" className="select-field" value={unreadOnly ? "unread" : "all"}
        onChange={(event) => { setUnreadOnly(event.target.value === "unread"); setPage(1); }}>
        <option value="all">Tất cả</option><option value="unread">Chưa đọc</option>
      </select>
    </div>
    {actionError && <p className="notice" role="alert">{actionError}</p>}
    {resource.error && <ErrorState cause={resource.error} onRetry={resource.reload} />}
    <Card className="card-pad">
      {resource.data?.items.length ? <ul className="notification-list">
        {resource.data.items.map((item) => <li key={item.id} className={item.isRead ? "" : "notification-unread"}>
          <div className="notification-list-heading">
            <strong>{item.title || "Thông báo Nexus"}</strong>
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time>
          </div>
          <p>{item.body || "Bạn có thông báo mới."}</p>
          <NotificationAction item={item} viewer={viewer} onRead={resource.reload} />
          {!item.isRead && <button type="button" className="button button-secondary button-small"
            disabled={busyId === item.id} onClick={() => void markRead(item.id)}>
            {busyId === item.id ? "Đang cập nhật…" : "Đánh dấu đã đọc"}
          </button>}
        </li>)}
      </ul> : resource.loading ? <LoadingState rows={4} label="Đang tải thông báo…" /> : resource.error ? null : <EmptyState title="Chưa có thông báo" description="Thông báo về đơn hàng, đấu giá và ví sẽ hiện ở đây." />}
    </Card>
    {!!resource.data && resource.data.pagination.totalPages > 1 && <nav className="catalog-pagination" aria-label="Phân trang thông báo">
      <button type="button" className="button button-secondary button-small" disabled={page <= 1 || resource.loading} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
      <span>Trang {page}/{resource.data.pagination.totalPages}</span>
      <button type="button" className="button button-secondary button-small" disabled={!resource.data.pagination.hasNextPage || resource.loading} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
    </nav>}
  </>;
}
