"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import "./TruncatedText.css";

const emptySubscribe = () => () => {};

export type TruncatedTextProps = {
  text: string;
  label?: string;
  className?: string;
  block?: boolean;
  maxWidth?: number | string;
};

/**
 * Keeps titles and long single-line values from wrapping or colliding with sibling components.
 * When the text overflows its container (or the viewport narrows), shows an ellipsis plus a compact "..."
 * button that opens a portaled full-text popover without triggering parent links or clickable table rows.
 */
export function TruncatedText({
  text,
  label,
  className = "",
  block = false,
  maxWidth,
}: TruncatedTextProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const value = valueRef.current;
    if (!wrapper || !value) return;

    const measure = () => {
      const overflowsWrapper = value.scrollWidth > wrapper.clientWidth + 1;
      const overflowsSelf = value.scrollWidth > value.clientWidth + 1;
      setIsTruncated((prev) => {
        const next = overflowsWrapper || (!prev && overflowsSelf);
        if (!next) setOpen(false);
        return next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    observer.observe(value);
    if (wrapper.parentElement) observer.observe(wrapper.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [text]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverWidth = Math.min(440, window.innerWidth - 24);
    const estHeight = 140;
    const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.left - popoverWidth / 2 + rect.width / 2));
    const showAbove = rect.bottom + estHeight + 12 > window.innerHeight && rect.top > estHeight;
    const top = showAbove ? Math.max(12, rect.top - estHeight - 8) : Math.min(window.innerHeight - 120, rect.bottom + 8);
    setCoords({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className={`truncated-text${block ? " truncated-text-block" : ""}${className ? ` ${className}` : ""}`}
      style={maxWidth != null ? { maxWidth } : undefined}
    >
      <span ref={valueRef} className="truncated-text-value" title={isTruncated ? text : undefined}>
        {text}
      </span>
      {isTruncated && (
        <button
          ref={triggerRef}
          type="button"
          className="truncated-text-more"
          aria-label={label ? `Xem toàn bộ ${label}` : "Xem toàn bộ nội dung"}
          aria-expanded={open}
          aria-controls={popoverId}
          title="Xem toàn bộ"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((prev) => !prev);
          }}
        >
          ...
        </button>
      )}
      {open && mounted && createPortal(
        <div
          ref={popoverRef}
          id={popoverId}
          role="dialog"
          aria-label={label ?? "Nội dung đầy đủ"}
          className="truncated-text-popover"
          style={{ top: coords.top, left: coords.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="truncated-text-popover-head">
            <strong>{label ?? "Nội dung đầy đủ"}</strong>
            <button
              type="button"
              className="truncated-text-popover-close"
              aria-label="Đóng"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              ✕
            </button>
          </div>
          <p className="truncated-text-popover-body">{text}</p>
        </div>,
        document.body,
      )}
    </span>
  );
}
