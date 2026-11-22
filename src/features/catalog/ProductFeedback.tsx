"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { useSession } from "@/components/auth/SessionProvider";
import { ProductReviewCard } from "@/features/reviews/ProductReviewCard";
import { reviewService } from "@/features/reviews/services/review.service";

type Review = { id: string; rating: number; comment: string | null; createdAt: string };
type ReviewPage = { items: Review[]; pagination: { hasNextPage: boolean } };
type Rating = { avgRating: number | null; reviewCount: number };

export function ProductFeedback({ productId }: { productId: string; canReport?: boolean }) {
  const { user } = useSession();
  const isBuyer = (user?.roles ?? [user?.role]).some((role) => String(role ?? "").toLowerCase() === "buyer");
  const mine = useApiResource(isBuyer ? `my-product-reviews:${productId}` : null, (signal) =>
    reviewService.myProductReviews(productId, signal)
  );
  const [page, setPage] = useState(1);
  const rating = useApiResource(`product-rating:${productId}`, (signal) =>
    api
      .get<ApiResponse<Rating> | Rating>(`/api/v1/products/${encodeURIComponent(productId)}/rating-summary`, { signal })
      .then(unwrap)
  );
  const reviews = useApiResource(`product-reviews:${productId}:${page}`, (signal) =>
    api
      .get<ApiResponse<ReviewPage> | ReviewPage>(
        `/api/v1/products/${encodeURIComponent(productId)}/reviews?page=${page}&pageSize=5`,
        { signal }
      )
      .then(unwrap)
  );

  return (
    <>
      <Card className="card-pad product-detail-card" aria-labelledby="product-feedback-title">
        <div className="product-detail-card-header">
          <h2 id="product-feedback-title" className="product-detail-inner-title" style={{ margin: 0 }}>
            Đánh giá sản phẩm
          </h2>
          {rating.data && (
            <span className="product-rating-badge">
              ★ {typeof rating.data.avgRating === "number" && rating.data.avgRating > 0 ? rating.data.avgRating.toFixed(1) : "5.0"} / 5.0 · {rating.data.reviewCount} đánh giá
            </span>
          )}
        </div>

        {rating.loading && <p className="product-detail-muted">Đang tải điểm đánh giá…</p>}
        {rating.error && <p className="notice" role="alert">{rating.error.message}</p>}
        {reviews.error && <p className="notice" role="alert">{reviews.error.message}</p>}

        <div className="product-reviews-list">
          {reviews.data?.items.length ? (
            reviews.data.items.map((review) => (
              <div className="product-review-item" key={review.id}>
                <div className="review-meta">
                  <span className="review-stars">★ {review.rating} / 5</span>
                  <span className="review-date">
                    {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <p className="review-comment">{review.comment || "Không có nhận xét chi tiết."}</p>
              </div>
            ))
          ) : (
            !reviews.loading && !reviews.error && (
              <p className="product-detail-muted" style={{ margin: "14px 0" }}>
                Chưa có nhận xét công khai nào cho sản phẩm này.
              </p>
            )
          )}
        </div>

        {Boolean(reviews.data?.items.length) && (
          <div className="action-row" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </button>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Trang {page}</span>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={!reviews.data?.pagination.hasNextPage}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
          </div>
        )}
      </Card>

      {mine.data?.length ? (
        <Card className="card-pad product-detail-card" aria-label="Đánh giá của bạn">
          <h2 className="product-detail-inner-title">Đánh giá của bạn</h2>
          {mine.data.map((review) => (
            <ProductReviewCard
              key={review.reviewId}
              productId={productId}
              productName="Đánh giá của bạn cho sản phẩm này"
              subOrderId={review.orderId}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}
