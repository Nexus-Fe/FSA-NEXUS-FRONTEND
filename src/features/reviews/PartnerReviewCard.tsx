"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { FileDropZone, IMAGE_UPLOAD_PRESET } from "@/components/ui/FileDropZone";
import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { ApiError } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { REVIEW_ERROR_TEXT, REVIEW_REASON_TEXT, reviewService, type ReviewReferenceType } from "./services/review.service";

const DATE = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" });

export function reviewErrorText(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError && cause.errorCode && REVIEW_ERROR_TEXT[cause.errorCode]) return REVIEW_ERROR_TEXT[cause.errorCode];
  return cause instanceof Error && !(cause instanceof ApiError) && cause.message ? cause.message : fallback;
}

/**
 * Reviews the other party of one order: the buyer reviews the seller, the seller reviews the buyer.
 * The server decides who that is, whether the order finished, and whether this review was already given;
 * the card only asks and then shows the answer.
 *
 * referenceId is a sub-order ID for "Order" (never the parent order's ID) and an auction order ID for "Auction".
 */
export function PartnerReviewCard({ referenceType, referenceId, title, counterpart }: {
  referenceType: ReviewReferenceType;
  referenceId: string | null | undefined;
  title: string;
  /** "người bán" or "người mua", used in the messages. */
  counterpart: string;
}) {
  const eligibility = useApiResource(
    referenceId ? `partner-review:${referenceType}:${referenceId}` : null,
    (signal) => reviewService.partnerEligibility(referenceType, referenceId as string, signal),
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = eligibility.data;
    if (busy || !referenceId || !answer?.canReview || !answer.revieweeId || !answer.reviewerRole) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const mediaUrls = images.length ? await reviewService.uploadReviewFiles(images) : [];
      const created = await reviewService.createPartnerReview({
        revieweeId: answer.revieweeId, reviewerRole: answer.reviewerRole, referenceType, referenceId, rating, comment, mediaUrls,
      });
      // A review that adds no points (for example a repeat positive review within a week) is still saved.
      setNotice(created.scoreImpact === 0
        ? `Đã ghi nhận đánh giá ${counterpart}. Đánh giá này không cộng thêm điểm uy tín vì đã có đánh giá tích cực gần đây từ cùng người.`
        : `Đã gửi đánh giá ${counterpart}.`);
      setComment("");
      setImages([]);
      eligibility.reload();
    } catch (cause) {
      setError(reviewErrorText(cause, `Không gửi được đánh giá ${counterpart}.`));
      eligibility.reload();
    } finally { setBusy(false); }
  }

  const answer = eligibility.data;
  return <Card className="card-pad">
    <h2>{title}</h2>
    {!referenceId && <p className="status-note">Đơn hàng chưa có mã để đánh giá.</p>}
    {referenceId && eligibility.loading && !answer && <p>Đang kiểm tra điều kiện đánh giá…</p>}
    {eligibility.error && <p className="notice" role="alert">{reviewErrorText(eligibility.error, "Chưa kiểm tra được điều kiện đánh giá.")} <button type="button" className="button button-secondary" onClick={eligibility.reload}>Thử lại</button></p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {answer && !answer.canReview && !notice && <p className="status-note" role="status">{REVIEW_REASON_TEXT[answer.reason ?? ""] ?? "Chưa thể đánh giá đơn này."}</p>}
    {answer?.canReview && <form className="auth-fields" onSubmit={(event) => void submit(event)}>
      <StarRatingInput value={rating} onChange={setRating} />
      <label className="field-wrap">Nhận xét<textarea className="textarea-field" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className="field-wrap"><span>Ảnh đính kèm (tùy chọn, tối đa 5 ảnh)</span><FileDropZone {...IMAGE_UPLOAD_PRESET} disabled={busy} onFilesChange={setImages} /></div>
      {answer.expiresAt && <small>Có thể đánh giá đến {DATE.format(new Date(answer.expiresAt))}.</small>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : `Gửi đánh giá ${counterpart}`}</button>
    </form>}
  </Card>;
}
