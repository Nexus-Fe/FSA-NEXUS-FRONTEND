import Link from "next/link";

/** An empty list or search, said once the same way everywhere: what is missing, why it matters, and the next step when there is one. */
export function EmptyState({
  title = "Chưa có dữ liệu",
  description,
  actionLabel,
  actionHref,
  compact = false,
  className = "",
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`no-data empty-state${compact ? " compact" : ""}${className ? ` ${className}` : ""}`} role="status">
      <strong>{title}</strong>
      {description && <p className="empty-state-description">{description}</p>}
      {actionLabel && actionHref && (
        <Link className="button button-secondary button-small" href={actionHref}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
