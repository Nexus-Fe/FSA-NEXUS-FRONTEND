"use client";

import { PaginationBar } from "./PaginationBar";

export type AdminPaginationProps = {
  page: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  onPageChange: (nextPage: number) => void;
  loading?: boolean;
  itemLabel?: string;
  hideIfSinglePage?: boolean;
  className?: string;
};

export function AdminPagination({
  page,
  pageSize = 20,
  totalItems,
  totalPages: propTotalPages,
  onPageChange,
  loading = false,
  itemLabel = "bản ghi",
  hideIfSinglePage = true,
  className = "",
}: AdminPaginationProps) {
  const computedTotalPages =
    propTotalPages ??
    (totalItems !== undefined && pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1);
  const totalPages = Math.max(1, computedTotalPages);

  if (hideIfSinglePage && totalPages <= 1) {
    return null;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const from = totalItems !== undefined && totalItems > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = totalItems !== undefined ? Math.min(page * pageSize, totalItems) : 0;

  return (
    <nav
      className={"admin-pagination-bar " + className}
      aria-label="Phân trang dữ liệu"
    >
      <div className="admin-pagination-controls">
        {/* Nút Về trang đầu (khi có nhiều hơn 5 trang và không ở trang 1) */}
        {totalPages > 5 && (
          <button
            type="button"
            className="admin-pagination-btn is-edge"
            disabled={!hasPrevious || loading}
            onClick={() => onPageChange(1)}
            aria-label="Trang đầu tiên"
            title="Trang đầu"
          >
            <span aria-hidden="true">«</span>
          </button>
        )}

        <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} disabled={loading} />

        {/* Nút Đến trang cuối (khi có nhiều hơn 5 trang và không ở trang cuối) */}
        {totalPages > 5 && (
          <button
            type="button"
            className="admin-pagination-btn is-edge"
            disabled={!hasNext || loading}
            onClick={() => onPageChange(totalPages)}
            aria-label="Trang cuối cùng"
            title="Trang cuối"
          >
            <span aria-hidden="true">»</span>
          </button>
        )}
      </div>

      {/* Thông tin số lượng hiển thị và vị trí trang */}
      <div className="admin-pagination-info">
        {totalItems !== undefined && totalItems > 0 ? (
          <span>
            Hiển thị <strong>{from}–{to}</strong> trên <strong>{totalItems}</strong> {itemLabel}
            <span className="admin-pagination-dot" aria-hidden="true">
              •
            </span>
            Trang <strong>{page}</strong> / <strong>{totalPages}</strong>
          </span>
        ) : (
          <span>
            Trang <strong>{page}</strong> / <strong>{totalPages}</strong>
          </span>
        )}
      </div>
    </nav>
  );
}
