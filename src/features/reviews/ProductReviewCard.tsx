"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { FileDropZone, IMAGE_UPLOAD_PRESET } from "@/components/ui/FileDropZone";
import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { useApiResource } from "@/lib/api/use-api-resource";
import { reviewErrorText } from "./PartnerReviewCard";
import { REVIEW_REASON_TEXT, reviewService } from "./services/review.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function imagesError(files: File[]): string {
  if (files.length > 5 || files.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024)) {
    return "Chọn tối đa 5 ảnh JPG, PNG hoặc WEBP, mỗi ảnh tối đa 5 MB.";
  }
  return "";
}

/**
 * Review of ONE product of ONE sub-order. The pair (subOrderId, productId) is what the server calls a purchase: the card for the
 * same product in another sub-order is a separate review, and sending one does not close the others.
 * The review can be edited or deleted here, where the sub-order is known.
 */
export function ProductReviewCard({ productId, productName, subOrderId }: { productId: string; productName: string; subOrderId: string | null | undefined }) {
  const key = subOrderId ? `product-review:${subOrderId}:${productId}` : null;
  const eligibility = useApiResource(key, (signal) => reviewService.productEligibility(productId, subOrderId as string, signal));
  const mine = useApiResource(key ? `${key}:mine` : null, (signal) => reviewService.myProductReviews(productId, signal));
  const existing = mine.data?.find((review) => review.orderId === subOrderId) ?? null;

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function reload() { eligibility.reload(); mine.reload(); }

  function formData(): FormData | null {
    const problem = imagesError(images);
    if (problem) { setError(problem); return null; }
    if (comment.trim().length < 3) { setError("Nhận xét cần ít nhất 3 ký tự."); return null; }
    const form = new FormData();
    if (!editing) form.append("orderId", subOrderId as string);
    form.append("rating", String(rating));
    form.append("comment", comment.trim());
    images.forEach((file) => form.append("reviewImages", file));
    return form;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !subOrderId) return;
    const form = formData();
    if (!form) return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (editing && existing) await reviewService.updateProductReview(existing.reviewId, form);
      else await reviewService.createProductReview(productId, form);
      setNotice(editing ? "Đã cập nhật đánh giá sản phẩm." : "Đã gửi đánh giá sản phẩm.");
      setEditing(false); setComment(""); setImages([]);
      reload();
    } catch (cause) {
      setError(reviewErrorText(cause, "Không gửi được đánh giá sản phẩm."));
      reload();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (busy || !existing) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await reviewService.deleteProductReview(existing.reviewId);
      setNotice("Đã xóa đánh giá sản phẩm.");
      setConfirmDelete(false);
      reload();
    } catch (cause) {
      setError(reviewErrorText(cause, "Không xóa được đánh giá."));
    } finally { setBusy(false); }
  }

  function startEdit() {
    if (!existing) return;
    setRating(existing.rating); setComment(existing.comment ?? ""); setImages([]); setEditing(true); setNotice(""); setError("");
  }

  const answer = eligibility.data;
  const showForm = editing || (answer?.canReview && !existing);
  return <Card className="card-pad">
    <h3>{productName}</h3>
    {!subOrderId && <p className="status-note">Chưa xác định được đơn con của sản phẩm này nên chưa thể đánh giá.</p>}
    {subOrderId && eligibility.loading && !answer && <p>Đang kiểm tra điều kiện đánh giá…</p>}
    {(eligibility.error || mine.error) && <p className="notice" role="alert">{reviewErrorText(eligibility.error ?? mine.error, "Chưa kiểm tra được điều kiện đánh giá.")} <button type="button" className="button button-secondary" onClick={reload}>Thử lại</button></p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="notice" role="alert">{error}</p>}

    {existing && !editing && <div>
      <p>Đánh giá của bạn: <strong>{existing.rating}/5 sao</strong>{existing.status !== "Published" && <> · <em>{existing.status === "Hidden" ? "đã bị ẩn bởi quản trị" : existing.status}</em></>}</p>
      {existing.comment && <p>{existing.comment}</p>}
      <small>Gửi ngày {DATE.format(new Date(existing.createdAt))}</small>
      {existing.status !== "Hidden" && <div className="action-row">
        <button type="button" className="button button-secondary" onClick={startEdit} disabled={busy}>Sửa đánh giá</button>
        {confirmDelete
          ? <><button type="button" className="button button-primary" onClick={() => void remove()} disabled={busy}>Xác nhận xóa</button><button type="button" className="button button-secondary" onClick={() => setConfirmDelete(false)} disabled={busy}>Giữ lại</button></>
          : <button type="button" className="button button-secondary" onClick={() => setConfirmDelete(true)} disabled={busy}>Xóa đánh giá</button>}
      </div>}
    </div>}

    {answer && !answer.canReview && !existing && !notice && <p className="status-note" role="status">{REVIEW_REASON_TEXT[answer.reason ?? ""] ?? "Chưa thể đánh giá sản phẩm này."}</p>}

    {showForm && <form className="auth-fields" onSubmit={(event) => void submit(event)}>
      <StarRatingInput value={rating} onChange={setRating} />
      <label className="field-wrap">Nhận xét<textarea className="textarea-field" minLength={3} maxLength={2000} required value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="field-wrap"><span>{editing ? "Ảnh mới (thay toàn bộ ảnh cũ, tối đa 5)" : "Ảnh đánh giá (tối đa 5)"}</span><FileDropZone {...IMAGE_UPLOAD_PRESET} onFilesChange={setImages} /></div>
      {!editing && answer?.expiresAt && <small>Có thể đánh giá đến {DATE.format(new Date(answer.expiresAt))}.</small>}
      <div className="action-row">
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : editing ? "Lưu thay đổi" : "Gửi đánh giá sản phẩm"}</button>
        {editing && <button type="button" className="button button-secondary" onClick={() => setEditing(false)} disabled={busy}>Hủy</button>}
      </div>
    </form>}
  </Card>;
}
