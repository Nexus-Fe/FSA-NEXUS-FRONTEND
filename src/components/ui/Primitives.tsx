import Link from "next/link";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { TruncatedText } from "./TruncatedText";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  small = false,
  onClick,
  style,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "light";
  small?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  style?: CSSProperties;
}) {
  return (
    <Link
      className={"button button-" + variant + (small ? " button-small" : "")}
      href={href}
      onClick={onClick}
      style={style}
    >
      {children}
    </Link>
  );
}

export function DisabledAction({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return <button className={"button button-disabled" + (small ? " button-small" : "")} disabled title="Thao tác này chưa có API hoạt động">{children}</button>;
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <section className={"card " + className} style={style}>{children}</section>;
}

export type BadgeTone = "sky" | "green" | "amber" | "slate" | "red" | "indigo";

export function Badge({ children, tone = "sky" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}

export function PageHeading({ title, description, action, overline }: { title: string; description?: string; action?: ReactNode; overline?: string }) {
  return <div className="page-heading"><div className="page-heading-copy">{overline && <p className="overline">{overline}</p>}<h1><TruncatedText text={title} label="Tiêu đề trang" block /></h1>{description && <p className="page-description">{description}</p>}</div>{action && <div className="page-action">{action}</div>}</div>;
}

export function SectionHeading({ title, hint, action, id }: { title: string; hint?: string; action?: ReactNode; id?: string }) {
  return <div className="section-heading"><div className="section-heading-copy"><h2 id={id}><TruncatedText text={title} label="Tiêu đề mục" block /></h2>{hint && <p>{hint}</p>}</div>{action}</div>;
}

export function NoData({ className = "", title = "Chưa có dữ liệu" }: { className?: string; title?: string }) {
  return <div className={"no-data " + className} role="status"><strong>{title}</strong></div>;
}

export function EmptyTable({ columns }: { columns: string[] }) {
  return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody><tr className="table-empty"><td colSpan={columns.length}><NoData /></td></tr></tbody></table></div>;
}

export function clickableRowProps(onActivate: () => void, title?: string) {
  return {
    className: "clickable-row",
    tabIndex: 0,
    title,
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
      if ((event.target as HTMLElement | null)?.closest("a, button, input, select, textarea, .row-actions-wrap")) return;
      onActivate();
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}

export { AdminPagination } from "./AdminPagination";
export type { AdminPaginationProps } from "./AdminPagination";
export { TruncatedText } from "./TruncatedText";
export type { TruncatedTextProps } from "./TruncatedText";
