/* Lucian UX/UI Prompt #074 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#074 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { useApiResource } from "@/lib/api/use-api-resource";
import { NotificationAction } from "./NotificationAction";
import { notificationService } from "./services/notification.service";
import "./NotificationBell.css";

export function NotificationBell({ href, portal = false }: { href: string; portal?: boolean }) {
  // The seller portal links to the seller's pages; every other bell is the buyer's.
  const viewer = href.startsWith("/seller") ? "seller" : "buyer";
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const [ringing, setRinging] = useState(false);
  const [badgePop, setBadgePop] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const prevCountRef = useRef<number | null>(null);

  const resource = useApiResource(user?.id ? `notifications:bell:${user.id}` : null, async (signal) => {
    const [latest, unread] = await Promise.all([
      notificationService.getNotifications(1, 5, undefined, signal),
      notificationService.getNotifications(1, 1, false, signal),
    ]);
    return { latest: latest.items, unreadCount: unread.pagination.totalCount };
  });

  const count = resource.data?.unreadCount ?? 0;

  useEffect(() => {
    if (prevCountRef.current !== null && count > prevCountRef.current) {
      setRinging(true);
      setBadgePop(true);
    }
    prevCountRef.current = count;
  }, [count]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  if (!user) return null;

  async function markRead(id: string) {
    setBusyId(id);
    try {
      await notificationService.markAsRead(id);
      setActionError("");
      resource.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không cập nhật được thông báo.");
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    const unreadItems = (resource.data?.latest ?? []).filter((item) => !item.isRead);
    if (!unreadItems.length || markingAll) return;
    setMarkingAll(true);
    setActionError("");
    try {
      await Promise.all(unreadItems.map((item) => notificationService.markAsRead(item.id)));
      resource.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không thể đánh dấu tất cả đã đọc.");
    } finally {
      setMarkingAll(false);
    }
  }

  const allItems = resource.data?.latest ?? [];
  const visibleItems = tab === "unread" ? allItems.filter((item) => !item.isRead) : allItems;
  const unreadInList = allItems.some((item) => !item.isRead);

  return (
    <div
      ref={rootRef}
      className={`u074${open ? "" : " is-closed"}${portal ? " notification-bell-portal" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          bellRef.current?.focus({ preventScroll: true });
        }
      }}
    >
      <button
        ref={bellRef}
        type="button"
        className={`u074-bell${ringing ? " ring" : ""}`}
        aria-expanded={open}
        aria-label={count ? `Thông báo, ${count} chưa đọc` : "Thông báo"}
        onAnimationEnd={() => setRinging(false)}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) resource.reload();
        }}
      >
        <svg viewBox="0 0 22 22" aria-hidden="true">
          <path d="M5.5 15V10a5.5 5.5 0 0 1 11 0v5l1.5 1.5h-14zM9 18.5a2 2 0 0 0 4 0" />
        </svg>
        <span
          className={`u074-badge${count <= 0 ? " zero" : ""}${badgePop ? " is-pop" : ""}`}
          aria-hidden="true"
          onAnimationEnd={() => setBadgePop(false)}
        >
          {count > 99 ? "99+" : count}
        </span>
      </button>

      <div className="u074-pan" role="region" aria-label="Danh sách thông báo" aria-hidden={!open}>
        <div className="u074-ph" role="tablist" aria-label="Lọc thông báo">
          <button
            type="button"
            className="u074-tab"
            role="tab"
            tabIndex={open ? 0 : -1}
            aria-selected={tab === "all"}
            onClick={() => setTab("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            className="u074-tab"
            role="tab"
            tabIndex={open ? 0 : -1}
            aria-selected={tab === "unread"}
            onClick={() => setTab("unread")}
          >
            Chưa đọc
          </button>
          <button
            type="button"
            className="u074-all"
            tabIndex={open ? 0 : -1}
            disabled={!unreadInList || markingAll}
            onClick={() => void markAllRead()}
          >
            {markingAll ? "Đang xử lý…" : "Đánh dấu tất cả"}
          </button>
        </div>

        {resource.error && (
          <p className="u074-state" role="alert">
            Không tải được thông báo.{" "}
            <button type="button" className="u074-mark" onClick={resource.reload}>Thử lại</button>
          </p>
        )}
        {actionError && <p className="u074-state" role="alert">{actionError}</p>}
        {resource.loading && !resource.data && <p className="u074-state" role="status">Đang tải thông báo…</p>}
        {!resource.loading && !resource.error && !visibleItems.length && (
          <p className="u074-state">{tab === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo."}</p>
        )}

        {!!visibleItems.length && (
          <ul className="u074-list" aria-live="polite">
            {visibleItems.map((item) => (
              <li key={item.id} className="u074-it">
                <div className={`u074-row${item.isRead ? " read" : ""}`}>
                  <div className="u074-tx">
                    <strong>{item.title || "Thông báo Nexus"}</strong>
                    <p>{item.body || "Bạn có thông báo mới."}</p>
                  </div>
                  <div className="u074-meta">
                    <NotificationAction item={item} viewer={viewer} onRead={resource.reload} />
                    {!item.isRead && (
                      <button
                        type="button"
                        className="u074-mark"
                        tabIndex={open ? 0 : -1}
                        disabled={busyId === item.id || markingAll}
                        onClick={() => void markRead(item.id)}
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>
                  <span className="u074-dot" aria-hidden="true" />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="u074-foot">
          <Link href={href} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
            Xem tất cả
          </Link>
        </div>
      </div>
    </div>
  );
}
