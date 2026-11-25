/* Lucian UX/UI Prompt #449 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#449 */
"use client";

import { useEffect, useState } from "react";
import "./PaginationBar.css";

export type PageItem = number | "ellipsis";

/** Seven stable slots for long lists; every page is shown when there are seven or fewer. */
export function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages];
  if (currentPage >= totalPages - 3) return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
}

function Slot({ item, current, back, disabled, onSelect }: { item: PageItem; current: boolean; back: boolean; disabled: boolean; onSelect: (page: number) => void }) {
  const [shown, setShown] = useState(item);
  const [leaving, setLeaving] = useState<{ item: PageItem } | null>(null);
  if (shown !== item) {
    setLeaving({ item: shown });
    setShown(item);
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), 320);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const dots = item === "ellipsis";
  const text = (value: PageItem) => (value === "ellipsis" ? "…" : String(value));
  return (
    <button
      type="button"
      className={`u449-n${dots ? " is-dots" : ""}${back ? " is-back" : ""}`}
      aria-hidden={dots || undefined}
      tabIndex={dots ? -1 : 0}
      aria-label={dots ? undefined : `Trang ${item}`}
      aria-current={current ? "page" : undefined}
      disabled={disabled && !dots}
      onClick={() => { if (!dots) onSelect(item); }}
    >
      {leaving && <span className="is-out" aria-hidden="true">{text(leaving.item)}</span>}
      <span className={leaving ? "is-in" : undefined}>{text(item)}</span>
    </button>
  );
}

export function PaginationBar({ page, totalPages, onPageChange, disabled = false }: { page: number; totalPages: number; onPageChange: (page: number) => void; disabled?: boolean }) {
  const [prevPage, setPrevPage] = useState(page);
  const [back, setBack] = useState(false);
  const [tick, setTick] = useState(0);
  if (prevPage !== page) {
    setBack(page < prevPage);
    setPrevPage(page);
    setTick((value) => value + 1);
  }

  const items = getPageItems(page, totalPages);
  const at = Math.max(0, items.indexOf(page));
  return (
    <div className="u449" role="group" aria-label="Các trang">
      <button type="button" className="u449-ar" aria-label="Trang trước" disabled={disabled || page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
      </button>
      <div className="u449-sl" style={{ gridTemplateColumns: `repeat(${items.length}, 32px)` }}>
        <span className="u449-pill" data-t={tick % 2} style={{ ["--x" as string]: `${at * 34}px` }} aria-hidden="true" />
        {items.map((item, index) => (
          <Slot key={index} item={item} current={item === page} back={back} disabled={disabled} onSelect={onPageChange} />
        ))}
      </div>
      <button type="button" className="u449-ar" aria-label="Trang sau" disabled={disabled || page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
      </button>
      <p className="u449-live" role="status">{`Trang ${page}`}</p>
    </div>
  );
}
