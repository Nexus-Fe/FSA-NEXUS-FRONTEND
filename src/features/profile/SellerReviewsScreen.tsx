"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, NoData, PageHeading } from "@/components/ui/Primitives";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { ReputationScore } from "./ReputationScore";
import { profileService } from "./services/profile.service";
import { ErrorState, LoadingState } from "@/components/ui/States";

export function SellerReviewsScreen() {
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const profile = useApiResource("seller-reviews-profile", (signal) => profileService.getProfile(signal));
  const reputation = useApiResource("seller-reviews-reputation", (signal) => profileService.getMyReputation(signal));
  const reviews = useApiResource(profile.data?.id ? `seller-reviews:${profile.data.id}:${page}:${rating ?? "all"}` : null,
    (signal) => profileService.getReceivedReviews(profile.data!.id, page, rating, signal));

  return <div className="seller-reviews-page">
    <PageHeading title="Đánh giá & uy tín" description="Theo dõi uy tín Seller và các đánh giá khách hàng đã gửi cho bạn." action={<Link className="button button-secondary" href={ROUTES.buyer.reputation}>Xem chính sách uy tín</Link>} />
    {profile.error && <ErrorState title="Không tải được hồ sơ" cause={profile.error} onRetry={profile.reload} />}
    {reputation.error && <ErrorState title="Không tải được điểm Seller" cause={reputation.error} onRetry={reputation.reload} />}
    {reputation.data && <ReputationScore score={reputation.data.sellerScore} level={reputation.data.sellerTrustLevel} heading="Điểm uy tín Seller" description="Điểm dành cho vai trò người bán" />}
    <Card className="card-pad">
      <div className="section-heading"><div><h2>Đánh giá nhận được</h2><p>{reviews.data ? `${reviews.data.pagination.totalCount} đánh giá` : "Đánh giá từ giao dịch đã hoàn tất"}</p></div>
        <label className="field-wrap">Lọc số sao
          <select className="select-field" value={rating ?? ""} onChange={(event) => { setRating(event.target.value ? Number(event.target.value) : null); setPage(1); }}>
            <option value="">Tất cả</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
          </select>
        </label>
      </div>
      {reviews.error && <ErrorState title="Không tải được đánh giá" cause={reviews.error} onRetry={reviews.reload} />}
      {reviews.loading && <LoadingState label="Đang tải đánh giá…" />}
      {reviews.data && (reviews.data.items.length ? <div className="received-review-list">{reviews.data.items.map((review) => <article className="received-review" key={review.reviewId}>
        <div><strong>{review.reviewerDisplayNameMasked || "Người mua"}</strong><span aria-label={`${review.rating} trên 5 sao`}> · {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>
        <p>{review.comment || "Không có nhận xét"}</p>
        <small>{review.referenceType || "Đơn hàng"} · {new Date(review.createdAt).toLocaleDateString("vi-VN")}</small>
      </article>)}</div> : <NoData title="Chưa có đánh giá phù hợp" />)}
      {reviews.data && reviews.data.pagination.totalPages > 1 && <nav className="pagination" aria-label="Trang đánh giá">
        <button className="button button-secondary" type="button" disabled={!reviews.data.pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
        <span>Trang {page}/{reviews.data.pagination.totalPages}</span>
        <button className="button button-secondary" type="button" disabled={!reviews.data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
      </nav>}
    </Card>
  </div>;
}
