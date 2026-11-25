import type { CSSProperties } from "react";

/*
 * Loading placeholders shaped like the content they stand in for. Server-safe (no hooks), so a `loading.tsx` can render them
 * straight from the server. Every wrapper announces itself once; the grey blocks are decoration.
 */

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-lines" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="skeleton-line" style={{ width: index === lines - 1 ? "58%" : `${92 - (index % 2) * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <Skeleton className="skeleton-card-media" />
          <Skeleton className="skeleton-line" style={{ width: "84%" }} />
          <Skeleton className="skeleton-line" style={{ width: "46%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-table-row" key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="skeleton-line" style={{ width: column === 0 ? "88%" : "64%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="skeleton-stat" aria-hidden="true">
      <Skeleton className="skeleton-line" style={{ width: "34%" }} />
      <Skeleton className="skeleton-stat-value" />
    </div>
  );
}

export type SkeletonVariant = "page" | "list" | "cards" | "detail" | "form";

/** A whole screen: heading, then the body that matches the kind of page. */
export function SkeletonPage({ variant = "page", label = "Đang tải…" }: { variant?: SkeletonVariant; label?: string }) {
  return (
    <div className="skeleton-page" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton-page-heading" aria-hidden="true">
        <Skeleton className="skeleton-title" />
        <Skeleton className="skeleton-line" style={{ width: "32%" }} />
      </div>
      {variant === "page" && <div className="card card-pad" aria-hidden="true"><SkeletonLines lines={6} /></div>}
      {variant === "cards" && <SkeletonCards />}
      {variant === "list" && <div className="card card-pad"><SkeletonTable /></div>}
      {variant === "detail" && (
        <div className="skeleton-detail" aria-hidden="true">
          <div className="card card-pad"><Skeleton className="skeleton-detail-media" /></div>
          <div className="card card-pad"><SkeletonStat /><SkeletonLines lines={4} /></div>
        </div>
      )}
      {variant === "form" && (
        <div className="card card-pad skeleton-form" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Skeleton className="skeleton-line" style={{ width: "26%" }} />
              <Skeleton className="skeleton-input" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
