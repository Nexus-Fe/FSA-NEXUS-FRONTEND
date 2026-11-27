"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import "./SelectBox.css";

export type SelectBoxOption = {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
};

export type SelectBoxProps = {
  id?: string;
  name?: string;
  value: string;
  options: readonly SelectBoxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function SelectBox({
  id,
  name,
  value,
  options,
  onChange,
  placeholder = "Chọn…",
  searchable,
  searchPlaceholder = "Tìm nhanh…",
  disabled = false,
  ariaLabel,
  className = "",
}: SelectBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 220,
  });

  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showSearch = searchable ?? options.length >= 8;
  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.group ? opt.group.toLowerCase().includes(q) : false),
    );
  }, [options, query]);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 16, Math.max(rect.width, 200));
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left));
    const estHeight = Math.min(280, filteredOptions.length * 36 + (showSearch ? 52 : 16));
    const up = rect.bottom + estHeight + 12 > window.innerHeight && rect.top > estHeight;
    const top = up ? Math.max(8, rect.top - estHeight - 6) : rect.bottom + 6;
    setCoords({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filteredOptions.length]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      if (showSearch) {
        searchRef.current?.focus({ preventScroll: true });
      } else {
        popoverRef.current?.focus({ preventScroll: true });
      }
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onScrollOrResize = (event: Event) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function selectOption(opt: SelectBoxOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus({ preventScroll: true });
  }

  function onPopoverKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const enabled = filteredOptions.filter((opt) => !opt.disabled);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (enabled.length === 0) return;
      setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (enabled.length === 0) return;
      setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (event.key === "Enter") {
      const current = filteredOptions[activeIndex];
      if (current && !current.disabled) {
        event.preventDefault();
        selectOption(current);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery("");
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const popover = open ? (
    <div
      ref={popoverRef}
      id={listboxId}
      role="listbox"
      tabIndex={-1}
      aria-label={ariaLabel}
      className="select-box-popover"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
      onKeyDown={onPopoverKeyDown}
    >
      {showSearch && (
        <input
          ref={searchRef}
          type="search"
          className="select-box-search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
      )}
      <div className="select-box-list">
        {filteredOptions.length === 0 ? (
          <div className="select-box-empty">Không có lựa chọn phù hợp</div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const prevGroup = idx > 0 ? filteredOptions[idx - 1]?.group : undefined;
            const showGroup = opt.group && opt.group !== prevGroup;
            const isSelected = opt.value === value;
            const isActive = idx === activeIndex;
            return (
              <div key={`${opt.group ?? ""}:${opt.value}:${idx}`}>
                {showGroup && <div className="select-box-group-label">{opt.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  className={`select-box-option${isSelected ? " is-selected" : ""}${isActive ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectOption(opt)}
                >
                  <span>{opt.label}</span>
                  {isSelected && <span aria-hidden="true">✓</span>}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        className={`select-field select-box-trigger${className ? ` ${className}` : ""}`}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            setQuery("");
            setActiveIndex(Math.max(0, options.findIndex((opt) => opt.value === value && !opt.disabled)));
          } else {
            setQuery("");
          }
          setOpen((prev) => !prev);
        }}
      >
        <span className={`select-box-value${!selectedOption ? " is-placeholder" : ""}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="select-box-chevron" aria-hidden="true">
          <Icon name="chevronDown" size={16} />
        </span>
      </button>
      {typeof document !== "undefined" && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
