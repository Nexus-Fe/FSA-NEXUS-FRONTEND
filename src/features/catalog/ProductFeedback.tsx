"use client";

import { useState } from "react";
import { Card, SectionHeading } from "@/components/ui/Primitives";
import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";

type Review = { id: string; rating: number; comment: string | null; createdAt: string };
type ReviewPage = { items: Review[]; pagination: { hasNextPage: boolean } };
type Rating = { avgRating: number | null; reviewCount: number };

export function ProductFeedback({ productId, canReport }: { productId: string; canReport: boolean }) {
  const [page, setPage] = useState(1);
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được báo cáo sản phẩm."); }
    finally { setBusy(false); }
  }

  return <>
    <section className="product-detail-section" aria-labelledby="product-feedback-title"><SectionHeading id="product-feedback-title" title="Đánh giá sản phẩm" />
      <Card className="card-pad"><p>{rating.data ? `${rating.data.avgRating?.toFixed(1) ?? "—"}/5 · ${rating.data.reviewCount} đánh giá` : rating.loading ? "Đang tải điểm đánh giá…" : "Chưa có điểm đánh giá"}</p>
        {rating.error && <p className="notice" role="alert">{rating.error.message}</p>}
        {reviews.error && <p className="notice" role="alert">{reviews.error.message}</p>}
        {reviews.data?.items.length ? reviews.data.items.map((review) => <div className="info-row" key={review.id}><span>{review.rating}/5 · {new Date(review.createdAt).toLocaleDateString("vi-VN")}</span><strong>{review.comment || "Không có nhận xét"}</strong></div>) : !reviews.error && <p>Chưa có nhận xét công khai.</p>}
        <div className="action-row"><button type="button" className="button button-secondary button-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" className="button button-secondary button-small" disabled={!reviews.data?.pagination.hasNextPage} onClick={() => setPage(page + 1)}>Trang sau</button></div>
      </Card>
    </section>
    {canReport && <section className="product-detail-section"><SectionHeading title="Báo cáo sản phẩm" /><Card className="card-pad">
      {sent ? <p className="form-success" role="status">Đã gửi báo cáo để kiểm duyệt.</p> : <form className="auth-fields" onSubmit={(event) => void report(event)}>
        <label className="field-wrap">Lý do<select className="select-field" required value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Chọn lý do</option><option value="Counterfeit">Hàng giả</option><option value="ProhibitedItem">Hàng cấm</option><option value="IncorrectDescription">Mô tả sai</option><option value="OffensiveContent">Nội dung không phù hợp</option><option value="Other">Khác</option></select></label>
        <label className="field-wrap">Mô tả<textarea className="textarea-field" required minLength={10} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="field-wrap">Ảnh bằng chứng<input className="field" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => setImages(Array.from(event.target.files ?? []))} /></label>
        {error && <p className="notice" role="alert">{error}</p>}
        <button className="button button-secondary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi báo cáo sản phẩm"}</button>
      </form>}
    </Card></section>}
  </>;
}
