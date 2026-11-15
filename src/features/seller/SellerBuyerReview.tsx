"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Primitives";
import { api } from "@/lib/api/client";

export function SellerBuyerReview({ buyerId, subOrderId }: { buyerId: string; subOrderId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      await api.post("/api/v1/reviews", { revieweeId: buyerId, reviewerRole: "Seller", referenceType: "Order", referenceId: subOrderId, rating, comment: comment.trim() || null, mediaUrls: [] });
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được đánh giá người mua."); }
    finally { setBusy(false); }
  }

  return <Card className="card-pad"><h2>Đánh giá người mua</h2>{done ? <p className="form-success" role="status">Đã gửi đánh giá người mua.</p> : <form className="auth-fields" onSubmit={(event) => void submit(event)}><label className="field-wrap">Số sao<select className="select-field" value={rating} onChange={(event) => setRating(Number(event.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}</select></label><label className="field-wrap">Nhận xét<textarea className="textarea-field" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} /></label>{error && <p className="notice" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi đánh giá"}</button></form>}</Card>;
}
