/* Lucian UX/UI Prompt #431 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#431 */
"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import "./DatePicker.css";

const MONTHS = Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`);
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAYS_FULL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

const dayKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplay(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function describe(d: Date, isToday: boolean): string {
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}${isToday ? ", hôm nay" : ""}`;
}

export type DatePickerProps = {
  /** Selected date as YYYY-MM-DD, or an empty string. */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Past days are blocked unless this is true. */
  allowPast?: boolean;
  /** How many months after the current one can be reached. */
  maxMonthsAhead?: number;
};

export function DatePicker({ value, onChange, id, placeholder = "Chọn ngày", disabled = false, allowPast = false, maxMonthsAhead = 24 }: DatePickerProps) {
  const autoId = useId();
  const triggerId = id ?? `${autoId}-trigger`;
  const popoverId = `${autoId}-calendar`;
  const [today] = useState(() => startOfDay(new Date()));
  const selected = parseIso(value);
  const minDate = allowPast ? new Date(today.getFullYear() - 10, 0, 1) : today;
  const maxDate = new Date(today.getFullYear(), today.getMonth() + maxMonthsAhead + 1, 0);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1));
  const [slide, setSlide] = useState({ dir: 0, n: 0 });
  const [focusDay, setFocusDay] = useState<Date>(selected ?? today);
  const [announce, setAnnounce] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLElement>(null);
  const lastViewRef = useRef(-1);

  const clamp = (d: Date) => (dayKey(d) < dayKey(minDate) ? minDate : dayKey(d) > dayKey(maxDate) ? maxDate : d);
  const inView = (d: Date | null) => !!d && d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth();

  function focusButton(day: number) {
    window.requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus({ preventScroll: true });
    });
  }

  function openCalendar() {
    if (disabled) return;
    const base = clamp(selected ?? today);
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
    setFocusDay(base);
    setOpen(true);
    focusButton(base.getDate());
  }

  function closeCalendar(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }

  function shift(delta: number) {
    const next = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    if (monthIndex(next) < monthIndex(minDate) || monthIndex(next) > monthIndex(maxDate)) return;
    setView(next);
    setSlide((current) => ({ dir: delta, n: current.n + 1 }));
  }

  function pick(day: Date) {
    onChange(toIso(day));
    setFocusDay(day);
    setAnnounce(describe(day, dayKey(day) === dayKey(today)));
    window.setTimeout(() => setOpen(false), 280);
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".u431-d");
    if (!button) return;
    const current = new Date(view.getFullYear(), view.getMonth(), Number(button.dataset.day));
    let next: Date;
    if (event.key === "ArrowRight") next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    else if (event.key === "ArrowLeft") next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1);
    else if (event.key === "ArrowDown") next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    else if (event.key === "ArrowUp") next = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
    else if (event.key === "PageDown" || event.key === "PageUp") next = new Date(current.getFullYear(), current.getMonth() + (event.key === "PageDown" ? 1 : -1), Math.min(current.getDate(), 28));
    else return;
    event.preventDefault();
    next = clamp(next);
    const delta = monthIndex(next) - monthIndex(view);
    if (delta) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
      setSlide((s) => ({ dir: delta, n: s.n + 1 }));
    }
    setFocusDay(next);
    focusButton(next.getDate());
  }

  // Close on outside pointer or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Move the selection circle to the chosen day (jump without animation when the month changes).
  useLayoutEffect(() => {
    const sel = selRef.current;
    const grid = gridRef.current;
    if (!open || !sel || !grid) return;
    const button = selected && inView(selected) ? grid.querySelector<HTMLButtonElement>(`[data-day="${selected.getDate()}"]`) : null;
    const jump = lastViewRef.current !== monthIndex(view);
    lastViewRef.current = monthIndex(view);
    sel.classList.toggle("is-jump", jump);
    if (button) {
      sel.style.setProperty("--sx", `${button.offsetLeft}px`);
      sel.style.setProperty("--sy", `${button.offsetTop}px`);
    }
    sel.style.setProperty("--ss", button ? "1" : "0");
    if (jump) {
      void sel.offsetWidth;
      sel.classList.remove("is-jump");
    }
  });

  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const tabDay = inView(focusDay) ? focusDay.getDate() : inView(selected) ? selected!.getDate() : 1;
  const cells = Array.from({ length: 42 }, (_, i) => i - firstOfMonth + 1);

  return (
    <div
      className="u431"
      ref={rootRef}
      onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); closeCalendar(true); } }}
    >
      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        className="field u431-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => (open ? closeCalendar(false) : openCalendar())}
      >
        <span className={selected ? undefined : "is-empty"}>{selected ? formatDisplay(selected) : placeholder}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>
      </button>
      {open && (
        <div className="u431-c" id={popoverId} role="dialog" aria-label="Chọn ngày">
          <div className="u431-hd">
            <b aria-live="polite">{MONTHS[view.getMonth()]} {view.getFullYear()}</b>
            <button type="button" className="u431-nav" aria-label="Tháng trước" disabled={monthIndex(view) <= monthIndex(minDate)} onClick={() => shift(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg>
            </button>
            <button type="button" className="u431-nav" aria-label="Tháng sau" disabled={monthIndex(view) >= monthIndex(maxDate)} onClick={() => shift(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg>
            </button>
          </div>
          <div className="u431-wk" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="u431-gw">
            <i className="u431-sel" ref={selRef} aria-hidden="true" />
            <div
              key={slide.n}
              ref={gridRef}
              className={`u431-g${slide.dir > 0 ? " is-l" : slide.dir < 0 ? " is-r" : ""}`}
              role="grid"
              aria-label="Các ngày"
              onKeyDown={onGridKeyDown}
            >
              {cells.map((day, index) => {
                if (day < 1 || day > daysInMonth) return <span role="gridcell" key={index} />;
                const date = new Date(view.getFullYear(), view.getMonth(), day);
                const isToday = dayKey(date) === dayKey(today);
                const enabled = dayKey(date) >= dayKey(minDate) && dayKey(date) <= dayKey(maxDate);
                const isSelected = !!selected && dayKey(date) === dayKey(selected);
                return (
                  <button
                    type="button"
                    role="gridcell"
                    key={index}
                    className="u431-d"
                    data-day={day}
                    tabIndex={day === tabDay && enabled ? 0 : -1}
                    aria-selected={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={describe(date, isToday)}
                    disabled={!enabled}
                    onClick={() => pick(date)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <p className="u431-live" role="status">{announce}</p>
    </div>
  );
}
