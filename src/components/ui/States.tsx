"use client";

import type { ReactNode } from "react";
import { describeError, type ErrorOperation, type ErrorScope } from "@/lib/errors/error-messages";
import { NoData } from "./Primitives";

/** Placeholder rows while data loads. Announced once to assistive technology; the rows themselves are decoration. */
export function LoadingState({ rows = 3, label = "Đang tải dữ liệu…" }: { rows?: number; label?: string }) {
  return (
    <div className="state-loading" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton skeleton-row" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * A failed load or action. Shows the dictionary text (never the back end's own message), the next step when there is one,
 * and the trace id so support can find the request. `onRetry` is offered only when trying again is safe (a read, or a write whose
 * outcome is known to be a refusal); for an unknown write outcome pass no `onRetry` so the screen cannot invite a duplicate.
 */
export function ErrorState({
  cause,
  operation = "read",
  scope,
  onRetry,
  retryLabel = "Thử lại",
  title,
}: {
  cause: unknown;
  operation?: ErrorOperation;
  scope?: ErrorScope;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
}) {
  const described = describeError(cause, { operation, scope });
  const reference = [described.code, described.status ? `HTTP ${described.status}` : null, described.traceId].filter(Boolean).join(" · ");
  return (
    <div className="state-error notice" role="alert">
      {title && <strong>{title}</strong>}
      <p>{described.message}</p>
      {described.hint && <p>{described.hint}</p>}
      {reference && <p className="state-error-reference">Mã tham chiếu: {reference}</p>}
      {onRetry && described.kind !== "unknown-outcome" && (
        <button type="button" className="button button-secondary button-small" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Picks what a data screen shows: loading, the error, the empty state, or the content. Keeps every screen from showing a blank page
 * when the back end fails or answers with nothing.
 */
export function DataState({
  loading,
  error,
  empty,
  onRetry,
  emptyTitle,
  children,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  children: ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState cause={error} onRetry={onRetry} />;
  if (empty) return <NoData title={emptyTitle} />;
  return <>{children}</>;
}
