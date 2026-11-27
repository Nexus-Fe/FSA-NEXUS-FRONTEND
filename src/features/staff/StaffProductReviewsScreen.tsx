"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { EvidenceThumbnailGrid } from "@/components/ui/ImageLightbox";
import { StarDisplay } from "@/components/ui/StarRatingInput";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import {
  reviewModerationService,
  type AdminProductReviewItem,
} from "./services/review-moderation.service";

const STATUS_FILTERS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "Published", label: "Đang hiển thị" },
  { value: "Hidden", label: "Đã ẩn" },
] as const;

function reviewStatusLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "PUBLISHED") return "Đang hiển thị";
  if (normalized === "HIDDEN") return "Đã ẩn";
  return status;
}

function reviewStatusTone(status: string): "green" | "red" | "slate" {
  const normalized = status.toUpperCase();
  if (normalized === "PUBLISHED") return "green";
  if (normalized === "HIDDEN") return "red";
  return "slate";
}

export function StaffProductReviewsScreen() {
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [productIdInput, setProductIdInput] = useState("");
  const [appliedProductId, setAppliedProductId] = useState("");
  const [page, setPage] = useState(1);

  const [selectedReview, setSelectedReview] = useState<AdminProductReviewItem | null>(null);
  const [moderateAction, setModerateAction] = useState<"HIDE" | "PUBLISH">("HIDE");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");

  const resource = useApiResource(
    `admin-product-reviews:${page}:${status}:${rating}:${appliedProductId}`,
    (signal) =>
      reviewModerationService.list(
        {
          page,
          pageSize: 20,
          status: status || undefined,
          rating: rating ? Number(rating) : undefined,
          productId: appliedProductId || undefined,
        },
        signal,
      ),
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedProductId(productIdInput.trim());
  }

  function openModerate(review: AdminProductReviewItem, action: "HIDE" | "PUBLISH") {
    setSelectedReview(review);
    setModerateAction(action);
    setReason("");
    setActionError("");
    setFeedback("");
  }

  async function submitModeration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReview || busy) return;

    setBusy(true);
    setActionError("");
    setFeedback("");
    try {
      await reviewModerationService.moderate(selectedReview.id, {
        action: moderateAction,
        reason: reason.trim() || undefined,
      });
      setFeedback(
        moderateAction === "HIDE"
          ? `Đã ẩn đánh giá ${selectedReview.id.slice(0, 8)} khỏi trang sản phẩm.`
          : `Đã hiển thị lại đánh giá ${selectedReview.id.slice(0, 8)}.`,
      );
      setSelectedReview(null);
      setReason("");
      resource.reload();
    } catch (cause) {
      setActionError(formatError(describeError(cause, { operation: "write" })));
    } finally {
      setBusy(false);
    }
  }

  const items = resource.data?.items ?? [];
  const totalPages = resource.data?.totalPages ?? 1;

  return (
    <>
      <PageHeading
        overline="Kiểm duyệt nội dung"
        title="Kiểm duyệt đánh giá sản phẩm"
        description="Xem danh sách đánh giá sản phẩm từ người mua và ẩn hoặc hiển thị lại các đánh giá vi phạm tiêu chuẩn cộng đồng."
      />

      <Card className="card-pad" style={{ marginBottom: 16 }}>
        <form
          onSubmit={handleSearch}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label className="field-wrap" style={{ minWidth: 180 }}>
            Trạng thái
            <select
              className="select-field"
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-wrap" style={{ minWidth: 150 }}>
            Số sao
            <select
              className="select-field"
              value={rating}
              onChange={(event) => {
                setPage(1);
                setRating(event.target.value);
              }}
            >
              <option value="">Tất cả số sao</option>
              {[5, 4, 3, 2, 1].map((star) => (
                <option key={star} value={String(star)}>
                  {star} sao
                </option>
              ))}
            </select>
          </label>
          <label className="field-wrap" style={{ flex: "1 1 240px" }}>
            Mã sản phẩm (UUID)
            <input
              className="field"
              placeholder="Lọc theo productId (tùy chọn)"
              value={productIdInput}
              onChange={(event) => setProductIdInput(event.target.value)}
            />
          </label>
          <button type="submit" className="button button-primary button-small">
            Lọc
          </button>
          {(status || rating || appliedProductId) && (
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                setStatus("");
                setRating("");
                setProductIdInput("");
                setAppliedProductId("");
                setPage(1);
              }}
            >
              Xóa lọc
            </button>
          )}
        </form>
      </Card>

      {resource.error && (
        <p role="alert" className="notice">
          {formatError(describeError(resource.error))}
        </p>
      )}
      {actionError && (
        <p role="alert" className="notice">
          {actionError}
        </p>
      )}
      {feedback && (
        <p role="status" className="form-success">
          {feedback}
        </p>
      )}

      {selectedReview && (
        <Card className="card-pad" style={{ marginBottom: 16 }}>
          <h3>
            {moderateAction === "HIDE" ? "Ẩn đánh giá" : "Hiển thị lại đánh giá"}{" "}
            <code>{selectedReview.id.slice(0, 8)}</code>
          </h3>
          {selectedReview.comment && (
            <p style={{ color: "var(--muted)", marginTop: 4 }}>{selectedReview.comment}</p>
          )}
          <form onSubmit={(event) => void submitModeration(event)} className="auth-fields">
            <label className="field-wrap">
              Lý do kiểm duyệt (tùy chọn)
              <input
                className="field"
                maxLength={500}
                placeholder="Ví dụ: Ngôn từ không phù hợp hoặc nội dung spam"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <div className="action-row">
              <button type="submit" className="button button-primary button-small" disabled={busy}>
                {busy
                  ? "Đang xử lý…"
                  : moderateAction === "HIDE"
                    ? "Xác nhận ẩn đánh giá"
                    : "Xác nhận hiển thị lại"}
              </button>
              <button
                type="button"
                className="button button-secondary button-small"
                disabled={busy}
                onClick={() => setSelectedReview(null)}
              >
                Hủy
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {resource.loading && !resource.data ? (
          <NoData title="Đang tải danh sách đánh giá…" />
        ) : items.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đánh giá</th>
                  <th>Nội dung & Ảnh</th>
                  <th>Người mua</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((review) => {
                  const isHidden = review.status.toUpperCase() === "HIDDEN";
                  return (
                    <tr key={review.id}>
                      <td>
                        <Link href={ROUTES.catalog.product(review.productId)}>
                          <code>{review.productId.slice(0, 8)}</code>
                        </Link>
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <StarDisplay rating={review.rating} />
                          <strong>{review.rating}/5</strong>
                        </span>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                          {review.comment || "—"}
                        </p>
                        {review.reviewImages && review.reviewImages.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <EvidenceThumbnailGrid urls={review.reviewImages} size={44} title="Ảnh đánh giá" />
                          </div>
                        )}
                      </td>
                      <td>
                        <code>{review.buyerId.slice(0, 8)}</code>
                      </td>
                      <td>{new Date(review.createdAt).toLocaleString("vi-VN")}</td>
                      <td>
                        <Badge tone={reviewStatusTone(review.status)}>
                          {reviewStatusLabel(review.status)}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          onClick={() => openModerate(review, isHidden ? "PUBLISH" : "HIDE")}
                        >
                          {isHidden ? "Hiển thị lại" : "Ẩn đánh giá"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <NoData title="Không có đánh giá nào khớp bộ lọc" />
        )}
      </Card>

      {totalPages > 1 && resource.data && (
        <AdminPagination
          page={page}
          pageSize={resource.data.pageSize}
          totalItems={resource.data.total}
          totalPages={totalPages}
          onPageChange={setPage}
          itemLabel="đánh giá"
        />
      )}
    </>
  );
}
