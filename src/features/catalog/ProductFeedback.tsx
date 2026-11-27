"use client";

import { useState } from "react";
import { AdminPagination, Card, SectionHeading } from "@/components/ui/Primitives";
import { ErrorState } from "@/components/ui/States";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { useSession } from "@/components/auth/SessionProvider";
import { ProductReviewCard } from "@/features/reviews/ProductReviewCard";
import { ProductReviewSummary } from "@/components/catalog/ProductReviewSummary";
import { FileDropZone, IMAGE_UPLOAD_PRESET } from "@/components/ui/FileDropZone";
import { reviewService } from "@/features/reviews/services/review.service";
import { describeError, formatError } from "@/lib/errors/error-messages";

type Review = { id: string; rating: number; comment: string | null; reviewImages?: string[] | null; images?: string[] | null; createdAt: string };
type ReviewPage = { items: Review[]; pagination: { pageSize?: number; totalCount?: number; totalPages?: number; hasNextPage: boolean } };
type Rating = { avgRating: number | null; reviewCount: number };

export function ProductFeedback({ productId, canReport }: { productId: string; canReport: boolean }) {
  // The buyer's own reviews of this product, with the sub-order each belongs to, so they can be edited or deleted from here.
  const { user } = useSession();
  const isBuyer = (user?.roles ?? [user?.role]).some((role) => String(role ?? "").toLowerCase() === "buyer");
  const mine = useApiResource(isBuyer ? `my-product-reviews:${productId}` : null, (signal) => reviewService.myProductReviews(productId, signal));
  const [page, setPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const rating = useApiResource(`product-rating:${productId}`, (signal) => api.get<ApiResponse<Rating> | Rating>(`/api/v1/products/${encodeURIComponent(productId)}/rating-summary`, { signal }).then(unwrap));
  const reviews = useApiResource(`product-reviews:${productId}:${page}`, (signal) => api.get<ApiResponse<ReviewPage> | ReviewPage>(`/api/v1/products/${encodeURIComponent(productId)}/reviews?page=${page}&pageSize=5`, { signal }).then(unwrap));

  async function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!reason.trim() || description.trim().length < 10 || description.trim().length > 2000 || images.length < 1 || images.length > 5 || images.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError("Điền lý do, mô tả 10–2000 ký tự và chọn 1–5 ảnh JPG, PNG hoặc WEBP tối đa 5 MB mỗi ảnh.");
      return;
    }
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("reason", reason.trim()); body.append("description", description.trim()); images.forEach((file) => body.append("evidenceFiles", file));
      await api.post(`/api/v1/products/${encodeURIComponent(productId)}/reports`, body);
      setSent(true);
    } catch (cause) { setError(formatError(describeError(cause, { operation: "write" }))); }
    finally { setBusy(false); }
  }

  return <>
    <section className="product-detail-section" aria-labelledby="product-feedback-title"><SectionHeading id="product-feedback-title" title="Đánh giá sản phẩm" />
      <Card className="card-pad">
        <ProductReviewSummary
          avgRating={rating.data?.avgRating ?? null}
          reviewCount={rating.data?.reviewCount ?? 0}
          reviews={reviews.data?.items ?? []}
          loading={rating.loading || reviews.loading}
        />
        {rating.error && <ErrorState cause={rating.error} onRetry={rating.reload} />}
        {reviews.error && <ErrorState cause={reviews.error} onRetry={reviews.reload} />}
        <AdminPagination
          page={page}
          pageSize={reviews.data?.pagination.pageSize ?? 5}
          totalItems={reviews.data?.pagination.totalCount}
          totalPages={reviews.data?.pagination.totalPages ?? (reviews.data?.pagination.hasNextPage ? page + 1 : page)}
          loading={reviews.loading}
          onPageChange={setPage}
          itemLabel="đánh giá"
        />
      </Card>
    </section>
    {mine.data?.length ? <section className="product-detail-section" aria-label="Đánh giá của bạn"><SectionHeading title="Đánh giá của bạn" />
      {mine.data.map((review) => <ProductReviewCard key={review.reviewId} productId={productId} productName="Đánh giá của bạn cho sản phẩm này" subOrderId={review.orderId} />)}
    </section> : null}
    {canReport && <section className="product-detail-section"><SectionHeading title="Báo cáo sản phẩm" /><Card className="card-pad">
      {sent ? (
        <p className="form-success" role="status">Đã gửi báo cáo để kiểm duyệt.</p>
      ) : !reportOpen ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Phát hiện sản phẩm vi phạm, hàng giả hoặc sai mô tả?</span>
          <button type="button" className="button button-secondary button-small" onClick={() => setReportOpen(true)}>
            Báo cáo sản phẩm
          </button>
        </div>
      ) : (
        <form className="auth-fields" onSubmit={(event) => void report(event)}>
          <label className="field-wrap">Lý do<select className="select-field" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Chọn lý do</option><option value="Counterfeit">Hàng giả</option><option value="ProhibitedItem">Hàng cấm</option><option value="IncorrectDescription">Mô tả sai</option><option value="OffensiveContent">Nội dung không phù hợp</option><option value="Other">Khác</option></select></label>
          <label className="field-wrap">Mô tả<textarea className="textarea-field" required minLength={10} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <div className="field-wrap"><span>Ảnh bằng chứng</span><FileDropZone {...IMAGE_UPLOAD_PRESET} required hint="1–5 ảnh JPG, PNG hoặc WEBP · tối đa 5 MB/ảnh" onFilesChange={setImages} /></div>
          {error && <p className="notice" role="alert">{error}</p>}
          <div className="action-row">
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi báo cáo sản phẩm"}</button>
            <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setReportOpen(false); setError(""); }}>Hủy</button>
          </div>
        </form>
      )}
    </Card></section>}
  </>;
}
