"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { FluidChoiceBar } from "@/components/ui/FluidChoiceBar";
import { EvidenceThumbnailGrid } from "@/components/ui/ImageLightbox";
import { AdminPagination, Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { StarDisplay } from "@/components/ui/StarRatingInput";
import { ReputationHistoryBlock, ReputationPolicyBlock } from "@/features/account/ReputationDetails";
import { useApiResource } from "@/lib/api/use-api-resource";
import { reviewService } from "./services/review.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const SOURCE: Record<string, string> = { Order: "Đơn hàng", Auction: "Đơn đấu giá" };
const STAR_FILTER_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "5", label: "5★" },
  { value: "4", label: "4★" },
  { value: "3", label: "3★" },
  { value: "2", label: "2★" },
  { value: "1", label: "1★" },
];

/** Reviews the seller received, newest first, with the seller's score on top. */
export function SellerReviewsScreen() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState("");
  const reputation = useApiResource(userId ? "seller-reputation" : null, (signal) => reviewService.myReputation(signal));
  const reviews = useApiResource(
    userId ? `received-reviews:${userId}:${page}:${rating}` : null,
    (signal) => reviewService.received(userId as string, page, 10, rating ? Number(rating) : undefined, signal),
  );

  return (
    <>
      <PageHeading title="Đánh giá & uy tín" description="Đánh giá người mua dành cho gian hàng của bạn, từ các đơn đã hoàn tất." />
      {reputation.data && (
        <Card className="card-pad">
          <p><strong className="seller-money-amount">{reputation.data.sellerScore}</strong> điểm người bán · mức <strong>{reputation.data.sellerTrustLevel}</strong></p>
          <p>{reputation.data.sellerPositiveReviews} đánh giá tích cực · {reputation.data.sellerNegativeReviews} tiêu cực · {reputation.data.sellerPenaltyCount} lần bị phạt</p>
        </Card>
      )}
      {reputation.error && <p className="notice" role="alert">{reputation.error.message}</p>}
      <ReputationPolicyBlock />
      <ReputationHistoryBlock />

      <div className="seller-reviews-filter" style={{ margin: "14px 0" }}>
        <FluidChoiceBar
          mode="filter"
          ariaLabel="Lọc đánh giá theo số sao"
          options={STAR_FILTER_OPTIONS}
          value={rating}
          onChange={(next) => {
            setRating(next);
            setPage(1);
          }}
        />
      </div>

      {reviews.error && (
        <p className="notice" role="alert">
          {reviews.error.message} <button type="button" className="button button-secondary" onClick={reviews.reload}>Thử lại</button>
        </p>
      )}

      {reviews.loading && !reviews.data ? (
        <NoData title="Đang tải đánh giá…" />
      ) : reviews.data?.items.length ? (
        <Card className="card-pad">
          <div style={{ display: "grid", gap: "10px" }}>
            {reviews.data.items.map((review) => (
                <article
                  key={review.reviewId}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "#f5f8f6",
                    boxShadow: "inset 0 0 0 1px rgba(31, 32, 36, 0.09)",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <StarDisplay rating={review.rating} size={14} />
                      <strong style={{ fontSize: 13 }}>{review.reviewerDisplayNameMasked ?? "Người mua"}</strong>
                      <Badge tone="slate">{SOURCE[review.referenceType] ?? review.referenceType}</Badge>
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{DATE.format(new Date(review.createdAt))}</span>
                  </header>
                  <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)" }}>
                    {review.comment || "Không có nhận xét."}
                  </p>
                  {review.mediaUrls && review.mediaUrls.length > 0 && (
                    <EvidenceThumbnailGrid urls={review.mediaUrls} size={56} title="Ảnh đánh giá từ người mua" />
                  )}
                </article>
            ))}
          </div>
        </Card>
      ) : (
        !reviews.error && <NoData title="Chưa có đánh giá nào." />
      )}

      {reviews.data && reviews.data.pagination.totalPages > 1 && (
        <AdminPagination
          page={reviews.data.pagination.pageIndex}
          pageSize={reviews.data.pagination.pageSize}
          totalItems={reviews.data.pagination.totalCount}
          totalPages={reviews.data.pagination.totalPages}
          loading={reviews.loading}
          onPageChange={setPage}
          itemLabel="đánh giá"
        />
      )}
    </>
  );
}
