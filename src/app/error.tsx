"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ROUTES } from "@/constants/routes";

export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <main className="page-container" style={{ paddingBlock: 56 }}>
      <div className="card card-pad" style={{ maxWidth: 560, marginInline: "auto", textAlign: "center" }}>
        <h1 style={{ marginTop: 0 }}>Đã có sự cố khi hiển thị trang</h1>
        <p style={{ color: "var(--muted)" }}>
          Trang vừa gặp lỗi ngoài ý muốn. Bạn có thể thử tải lại hoặc quay về trang chủ.
        </p>
        {digest && (
          <p className="state-error-reference" style={{ marginBottom: 18 }}>
            Mã tham chiếu: {digest}
          </p>
        )}
        <div className="action-row" style={{ justifyContent: "center" }}>
          <button type="button" className="button button-primary" onClick={() => retry()}>
            Thử lại
          </button>
          <Link className="button button-secondary" href={ROUTES.home}>
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
