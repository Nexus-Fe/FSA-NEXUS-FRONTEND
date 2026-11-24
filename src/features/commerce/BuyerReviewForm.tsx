"use client";

import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { FileDropZone, IMAGE_UPLOAD_PRESET } from "@/components/ui/FileDropZone";

export function BuyerReviewForm({ kind, rating, onRatingChange, comment, onCommentChange, onImagesChange, busy, onSubmit }: {
  kind: "product" | "seller";
  rating: number;
  onRatingChange: (value: number) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  onImagesChange?: (files: File[]) => void;
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return <form className="auth-fields" onSubmit={onSubmit}>
    <StarRatingInput value={rating} onChange={onRatingChange} />
    <label className="field-wrap">Nhận xét
      <textarea className="textarea-field" maxLength={kind === "product" ? 2000 : 1000} value={comment} onChange={(event) => onCommentChange(event.target.value)} />
    </label>
    {kind === "product" && <div className="field-wrap"><span>Ảnh đánh giá (tối đa 5)</span>
      <FileDropZone {...IMAGE_UPLOAD_PRESET} onFilesChange={(files) => onImagesChange?.(files)} />
    </div>}
    <button className="button button-primary" type="submit" disabled={busy || rating === 0}>
      {busy ? "Đang gửi…" : kind === "product" ? "Gửi đánh giá sản phẩm" : "Gửi đánh giá người bán"}
    </button>
  </form>;
}
