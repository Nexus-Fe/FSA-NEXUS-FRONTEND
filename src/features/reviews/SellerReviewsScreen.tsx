"use client";

import { useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ReputationHistoryBlock, ReputationPolicyBlock } from "@/features/account/ReputationDetails";
import { Badge, Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { useApiResource } from "@/lib/api/use-api-resource";
import { reviewService } from "./services/review.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const SOURCE: Record<string, string> = { Order: "Đơn hàng", Auction: "Đơn đấu giá" };

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

  return <>
    <PageHeading title="Đánh giá & uy tín" description="Đánh giá người mua dành cho gian hàng của bạn, từ các đơn đã hoàn tất." />
    {reputation.data && <Card className="card-pad">
      <p><strong className="seller-money-amount">{reputation.data.sellerScore}</strong> điểm người bán · mức <strong>{reputation.data.sellerTrustLevel}</strong></p>
      <p>{reputation.data.sellerPositiveReviews} đánh giá tích cực · {reputation.data.sellerNegativeReviews} tiêu cực · {reputation.data.sellerPenaltyCount} lần bị phạt</p>
    </Card>}
    {reputation.error && <p className="notice" role="alert">{reputation.error.message}</p>}
    <ReputationPolicyBlock />
    <ReputationHistoryBlock />
    <div className="action-row"><label className="field-wrap">Lọc theo số sao
      <select className="select-field" value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}>
        <option value="">Tất cả</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
      </select></label></div>
    {reviews.error && <p className="notice" role="alert">{reviews.error.message} <button type="button" className="button button-secondary" onClick={reviews.reload}>Thử lại</button></p>}
    {reviews.loading && !reviews.data ? <NoData title="Đang tải đánh giá…" /> : reviews.data?.items.length ? <Card>
      {reviews.data.items.map((review) => <div className="info-row" key={review.reviewId}>
        <span><strong>{review.rating}/5</strong> · {review.reviewerDisplayNameMasked ?? "Người mua"} · {DATE.format(new Date(review.createdAt))} · <Badge tone="slate">{SOURCE[review.referenceType] ?? review.referenceType}</Badge></span>
        <span>{review.comment || "Không có nhận xét."}</span>
      </div>)}
    </Card> : !reviews.error && <NoData title="Chưa có đánh giá nào." />}
    {reviews.data && reviews.data.pagination.totalPages > 1 && <div className="action-row">
      <button className="button button-secondary" type="button" disabled={!reviews.data.pagination.hasPreviousPage || reviews.loading} onClick={() => setPage(page - 1)}>Trang trước</button>
      <span>Trang {reviews.data.pagination.pageIndex}/{reviews.data.pagination.totalPages}</span>
      <button className="button button-secondary" type="button" disabled={!reviews.data.pagination.hasNextPage || reviews.loading} onClick={() => setPage(page + 1)}>Trang sau</button>
    </div>}
  </>;
}
