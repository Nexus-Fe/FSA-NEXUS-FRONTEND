"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What an error boundary shows when a screen throws while rendering. The raw exception text is never shown (it is English and
 * technical); the digest is offered so support can find the matching server log.
 */
export function RouteError({ error, retry, homeHref = "/" }: { error: unknown; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  return (
    <div className="route-state" role="alert">
      <h1>Màn hình này gặp sự cố</h1>
      <p>Có lỗi xảy ra khi hiển thị nội dung. Dữ liệu của bạn không bị ảnh hưởng. Hãy thử lại, hoặc quay về trang chính.</p>
      {digest && <p className="route-state-reference">Mã tham chiếu: {digest}</p>}
      <div className="route-state-actions">
        <button type="button" className="button button-primary" onClick={() => retry()}>Thử lại</button>
        <Link className="button button-secondary" href={homeHref}>Về trang chính</Link>
      </div>
    </div>
  );
}

/** A page that does not exist, or a record that is gone or not visible to this account. */
export function RouteNotFound({
  title = "Không tìm thấy trang",
  description = "Đường dẫn có thể đã thay đổi hoặc nội dung không còn tồn tại.",
  homeHref = "/",
  homeLabel = "Về trang chủ",
}: {
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="route-state" role="status">
      <span className="route-state-code" aria-hidden="true">404</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="route-state-actions">
        <Link className="button button-primary" href={homeHref}>{homeLabel}</Link>
      </div>
    </div>
  );
}
