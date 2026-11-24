"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import "./RowActionsMenu.css";

export type RowActionItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
};

export type RowActionsMenuProps = {
  primary?: {
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary";
  };
  items: RowActionItem[];
  ariaLabel?: string;
};

export function RowActionsMenu({ primary, items, ariaLabel = "Thao tác khác" }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleItems = items.filter(Boolean);

  function updatePosition() {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const estHeight = visibleItems.length * 36 + 24;
    const up = rect.bottom + estHeight + 12 > window.innerHeight && rect.top > estHeight;
    const width = 184;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const top = up ? Math.max(8, rect.top - estHeight - 6) : rect.bottom + 6;
    setCoords({ top, left, up });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const menu = menuRef.current;
    if (menu && coords.up) {
      const btn = triggerRef.current;
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const realTop = Math.max(8, rect.top - menu.offsetHeight - 6);
        if (Math.abs(realTop - coords.top) > 2) {
          setCoords((prev) => ({ ...prev, top: realTop }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const firstItem = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])',
      );
      if (firstItem) {
        firstItem.focus({ preventScroll: true });
      } else {
        menuRef.current?.focus({ preventScroll: true });
      }
    });
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const nodes = menuRef.current
      ? Array.from(
          menuRef.current.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not(:disabled):not([aria-disabled="true"])',
          ),
        )
      : [];
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") {
      if (nodes.length === 0) return;
      event.preventDefault();
      nodes[(current + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      if (nodes.length === 0) return;
      event.preventDefault();
      nodes[(current - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  const primaryClass = `button ${primary?.variant === "primary" ? "button-primary" : "button-secondary"} button-small`;

  const menu = open ? (
    <div
      id={menuId}
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      aria-label={ariaLabel}
      className="row-actions-menu"
      style={{ top: coords.top, left: coords.left }}
      onKeyDown={onMenuKeyDown}
    >
      {visibleItems.map((item, idx) => (
        <Fragment key={`${item.label}-${idx}`}>
          {item.dividerBefore && <div className="row-actions-sep" role="separator" />}
          {item.href && !item.disabled ? (
            <Link
              href={item.href}
              role="menuitem"
              className={`row-actions-item${item.danger ? " is-danger" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ) : (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`row-actions-item${item.danger ? " is-danger" : ""}`}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.label}
            </button>
          )}
        </Fragment>
      ))}
    </div>
  ) : null;

  return (
    <div
      className="row-actions-wrap"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {primary && (
        primary.href ? (
          <Link className={primaryClass} href={primary.href}>
            {primary.label}
          </Link>
        ) : (
          <button type="button" className={primaryClass} disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </button>
        )
      )}
      {visibleItems.length > 0 && (
        <button
          ref={triggerRef}
          type="button"
          className="row-actions-more"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => {
            if (!open) updatePosition();
            setOpen((prev) => !prev);
          }}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>
      )}
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
