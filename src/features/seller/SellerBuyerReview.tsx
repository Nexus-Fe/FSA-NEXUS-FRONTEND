"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { StarRatingInput } from "@/components/ui/StarRatingInput";
import { api } from "@/lib/api/client";

export function SellerBuyerReview({ buyerId, subOrderId }: { buyerId: string; subOrderId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || rating === 0) return;
    setBusy(true); setError("");
    try {
      await api.post("/api/v1/reviews", { revieweeId: buyerId, reviewerRole: "Seller", referenceType: "Order", referenceId: subOrderId, rating, comment: comment.trim() || null, mediaUrls: [] });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được đánh giá người mua."); }
    finally { setBusy(false); }
  }

  return <Card className="card-pad"><h2>Đánh giá người mua</h2>{done ? <p className="form-success" role="status">Đã gửi đánh giá người mua.</p> : <form className="auth-fields" onSubmit={(event) => void submit(event)}><StarRatingInput value={rating} onChange={setRating} /><label className="field-wrap">Nhận xét<textarea className="textarea-field" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>{error && <p className="notice" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy || rating === 0}>{busy ? "Đang gửi…" : "Gửi đánh giá"}</button></form>}</Card>;
}
