/* Lucian UX/UI Prompt #261 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#261 */
"use client";

import { useEffect, useRef, useState } from "react";
import "./ProductReviewSummary.css";

export type ReviewSummaryItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

type Props = {
  avgRating: number | null;
  reviewCount: number;
  reviews: ReviewSummaryItem[];
  loading?: boolean;
};

const STARS = [5, 4, 3, 2, 1] as const;

export function ProductReviewSummary({ avgRating, reviewCount, reviews, loading = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedStar, setSelectedStar] = useState<number>(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const id = window.requestAnimationFrame(() => setRevealed(true));
      return () => window.cancelAnimationFrame(id);
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        observer.disconnect();
        window.requestAnimationFrame(() => setRevealed(true));
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const counts = STARS.map((star) => reviews.filter((r) => Math.round(r.rating) === star).length);
  const totalLoaded = counts.reduce((sum, n) => sum + n, 0);
  const maxBucket = Math.max(1, ...counts);
  const avgPercent = avgRating != null ? Math.max(0, Math.min(100, (avgRating / 5) * 100)) : 0;

  const visibleReviews = selectedStar > 0
    ? reviews.filter((r) => Math.round(r.rating) === selectedStar)
    : reviews;

  return (
    <div ref={rootRef} className={`u261${selectedStar > 0 ? " is-f" : ""}`}>
      <div className="u261-tp">
        <div className="u261-av">
          <b>{avgRating != null ? avgRating.toFixed(1) : "—"}</b>
          <span className="u261-st" aria-hidden="true">
            ★★★★★<i style={{ width: revealed ? `${avgPercent}%` : "0%" }}>★★★★★</i>
          </span>
          <small>{loading ? "Đang tải điểm đánh giá…" : `${reviewCount} đánh giá`}</small>
        </div>

        <div className="u261-bs" role="group" aria-label="Lọc đánh giá theo số sao">
          {STARS.map((star, index) => {
            const count = counts[index];
            const share = totalLoaded > 0 ? Math.round((count / totalLoaded) * 100) : 0;
            const scale = revealed && count > 0 ? (count / maxBucket).toFixed(3) : "0";
            const on = selectedStar === star;
            return (
              <button
                key={star}
                type="button"
                className={`u261-br${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => setSelectedStar((cur) => (cur === star ? 0 : star))}
              >
                <span>{star}★</span>
                <em>
                  <i
                    style={{
                      transform: `scaleX(${scale})`,
                      transitionDelay: `${0.15 + index * 0.07}s`,
                    }}
                  />
                </em>
                <span>{share}%</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="u261-hd">
        <span>{selectedStar > 0 ? `Đánh giá ${selectedStar} sao (${visibleReviews.length})` : `Tất cả đánh giá (${visibleReviews.length})`}</span>
        {selectedStar > 0 && (
          <button type="button" onClick={() => setSelectedStar(0)}>
            Xem tất cả
          </button>
        )}
      </div>

      <div className="u261-ls" aria-live="polite">
        {visibleReviews.length ? (
          visibleReviews.map((review, index) => {
            const clamped = Math.max(1, Math.min(5, Math.round(review.rating)));
            return (
              <article
                key={review.id}
                className="u261-rv"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <header>
                  <i aria-label={`${clamped}/5 sao`}>{"★★★★★".slice(0, clamped)}{"☆☆☆☆☆".slice(0, 5 - clamped)}</i>
                  <span>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</span>
                </header>
                <p>{review.comment || "Không có nhận xét"}</p>
              </article>
            );
          })
        ) : (
          <p className="u261-empty">
            {selectedStar > 0 ? `Chưa có đánh giá ${selectedStar} sao trên trang này.` : "Chưa có nhận xét công khai."}
          </p>
        )}
      </div>
    </div>
  );
}
