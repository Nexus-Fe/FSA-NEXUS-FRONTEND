"use client";

import Link from "next/link";
import { notificationService } from "./services/notification.service";
import { notificationTarget, type NotificationViewer } from "./notification-target";
import type { NotificationItem } from "./types";

/**
 * "Open what this notification is about". Clicking marks the notification read and goes to the target. When the target no longer accepts
 * action (an invitation that ran out) it says so instead of opening a dead end. An item with nothing to open shows nothing.
 */
export function NotificationAction({ item, viewer, onRead }: { item: NotificationItem; viewer: NotificationViewer; onRead?: () => void }) {
  const target = notificationTarget(item, viewer);
  if (!target) return null;
  if (target.kind === "unavailable") return <p className="status-note" role="status">{target.reason}</p>;

  return <Link className="button button-secondary button-small" href={target.href}
    onClick={() => {
      if (item.isRead) return;
      // The page moves on at once; a failed "read" mark only leaves the badge until the next reload.
      void notificationService.markAsRead(item.id).then(() => onRead?.(), () => undefined);
    }}>{target.label}</Link>;
}
