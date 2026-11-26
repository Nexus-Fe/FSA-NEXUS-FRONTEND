"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog shared by every Phase 2 screen.
 *  - Focus moves into the dialog when it opens, Tab and Shift+Tab stay inside it, and focus returns to the element that opened it.
 *  - Escape and a click on the backdrop close it, except while `busy` (a request is in flight and closing would hide its outcome).
 *  - It is labelled by its title for screen readers and the page behind it is hidden from them.
 */
export function Modal({
  open,
  title,
  onClose,
  busy = false,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);

  useEffect(() => {
    setMounted(true);
  }, []);
  // The key handler below must see the latest values without re-running (re-running would steal focus back into the dialog).
  useEffect(() => {
    busyRef.current = busy;
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        {children}
        {footer && <div className="voucher-dialog-actions">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
