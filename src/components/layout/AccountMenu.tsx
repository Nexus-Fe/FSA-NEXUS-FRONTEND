/* Lucian UX/UI Prompt #408 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#408 */
"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import "./AccountMenu.css";

export type AccountMenuItem = {
  href: string;
  label: string;
  icon: IconName;
  highlight?: boolean;
  dividerAfter?: boolean;
  badge?: string | number | null;
  ariaLabel?: string;
};

export type AccountMenuProps = {
  placement?: "down" | "up";
  triggerVariant?: "avatar" | "sidebar";
  displayName: string;
  avatarUrl?: string | null;
  subtitle?: string;
  rolePill?: { label: string; tone: string } | null;
  items: AccountMenuItem[];
  onLogout?: () => void;
  logoutBusy?: boolean;
  loginHref?: string;
  unreadBadge?: string | number | null;
  unreadLabel?: string;
  onOpen?: () => void;
};

export function AccountMenu({
  placement = "down",
  triggerVariant = "avatar",
  displayName,
  avatarUrl,
  subtitle,
  rolePill,
  items,
  onLogout,
  logoutBusy = false,
  loginHref,
  unreadBadge,
  unreadLabel,
  onOpen,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = displayName.trim().charAt(0).toLocaleUpperCase("vi-VN") || "N";

  function getMenuItems(): HTMLElement[] {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
  }

  function openMenu(focusIndex?: number) {
    if (!open) onOpen?.();
    setOpen(true);
    if (focusIndex !== undefined) {
      window.requestAnimationFrame(() => {
        const list = getMenuItems();
        if (!list.length) return;
        const target = list[(focusIndex + list.length) % list.length];
        target?.focus({ preventScroll: true });
      });
    }
  }

  function closeMenu(returnFocus: boolean) {
    if (!open) return;
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? 0 : -1);
    } else if (event.key === "Escape" && open) {
      event.stopPropagation();
      closeMenu(false);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = getMenuItems();
    if (!list.length) return;
    const current = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      list[(current + 1) % list.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      list[(current - 1 + list.length) % list.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  let stepIndex = 0;
  const rows: ReactNode[] = [];

  if (triggerVariant === "avatar") {
    rows.push(
      <div key="hd" className="u408-hd" style={{ ["--i" as string]: stepIndex++ }}>
        <b title={displayName}>{displayName}</b>
        {subtitle && <span>{subtitle}</span>}
        {rolePill && (
          <div style={{ marginTop: 4 }}>
            <span className={`role-pill role-pill-${rolePill.tone}`} style={{ fontSize: 9.5, padding: "2px 7px" }}>
              {rolePill.label}
            </span>
          </div>
        )}
      </div>,
    );
    rows.push(<div key="hd-hr" className="u408-hr" role="separator" style={{ ["--i" as string]: stepIndex++ }} />);
  }

  for (const item of items) {
    rows.push(
      <Link
        key={item.href + item.label}
        href={item.href}
        role="menuitem"
        tabIndex={-1}
        aria-label={item.ariaLabel}
        className={`u408-it${item.highlight ? " is-highlight" : ""}`}
        style={{ ["--i" as string]: stepIndex++ }}
        onClick={() => setOpen(false)}
      >
        <Icon name={item.icon} size={16} />
        <span>{item.label}</span>
        {item.badge != null && (
          <span className="notification-count u408-badge" aria-hidden="true">
            {item.badge}
          </span>
        )}
      </Link>,
    );
    if (item.dividerAfter) {
      rows.push(<div key={`${item.href}-hr`} className="u408-hr" role="separator" style={{ ["--i" as string]: stepIndex++ }} />);
    }
  }

  if (onLogout) {
    rows.push(<div key="logout-hr" className="u408-hr" role="separator" style={{ ["--i" as string]: stepIndex++ }} />);
    rows.push(
      <button
        key="logout"
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={logoutBusy}
        className="u408-it is-out"
        style={{ ["--i" as string]: stepIndex++ }}
        onClick={() => {
          setOpen(false);
          onLogout();
        }}
      >
        <Icon name="arrow" size={16} />
        <span>{logoutBusy ? "Đang đăng xuất…" : "Đăng xuất"}</span>
      </button>,
    );
  } else if (loginHref) {
    rows.push(
      <Link
        key="login"
        href={loginHref}
        role="menuitem"
        tabIndex={-1}
        className="u408-it"
        style={{ ["--i" as string]: stepIndex++ }}
        onClick={() => setOpen(false)}
      >
        <Icon name="user" size={16} />
        <span>Đăng nhập</span>
      </Link>,
    );
  }

  return (
    <div
      className={`u408${open ? " is-open" : ""}`}
      data-placement={placement}
      data-variant={triggerVariant}
    >
      <div className="u408-w" ref={wrapRef}>
        {triggerVariant === "avatar" ? (
          <>
            <button
              ref={triggerRef}
              type="button"
              className="u408-av"
              style={avatarUrl ? { overflow: "hidden" } : undefined}
              aria-label={`Mở menu tài khoản ${displayName}`}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => (open ? closeMenu(false) : openMenu())}
              onKeyDown={onTriggerKeyDown}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                initial
              )}
            </button>
            <span className="u408-dot" aria-hidden="true" />
          </>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="sidebar-bottom"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => (open ? closeMenu(false) : openMenu())}
            onKeyDown={onTriggerKeyDown}
          >
            <div className="avatar" aria-hidden="true" style={avatarUrl ? { overflow: "hidden" } : undefined}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                initial
              )}
            </div>
            <div className="portal-account-trigger-copy">
              <strong title={displayName}>{displayName}</strong>
              <span>{subtitle}</span>
            </div>
            {unreadBadge != null ? (
              <span className="notification-count portal-account-unread" aria-label={unreadLabel}>
                {unreadBadge}
              </span>
            ) : (
              <Icon name="chevronDown" size={16} />
            )}
          </button>
        )}

        <div
          id={menuId}
          ref={menuRef}
          className="u408-m"
          role="menu"
          aria-label="Menu tài khoản"
          aria-hidden={!open}
          onKeyDown={onMenuKeyDown}
        >
          {rows}
        </div>
      </div>
    </div>
  );
}
