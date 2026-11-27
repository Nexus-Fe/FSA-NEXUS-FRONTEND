"use client";

import { useId, useState } from "react";
import "./StarRatingInput.css";

const SENTIMENT_LABELS: Record<number, string> = {
  1: "Rất tệ",
  2: "Chưa hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
};

export function StarRatingInput({
  label = "Số sao",
  value,
  onChange,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const name = useId();
  const [hovered, setHovered] = useState(0);
  const activeValue = hovered > 0 ? hovered : value;

  return (
    <fieldset className="rating-picker" onMouseLeave={() => setHovered(0)}>
      <legend>{label}</legend>
      <div className="rating-picker-row">
        <div className="rating-picker-options">
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              className={`rating-picker-star${star <= activeValue ? " is-selected" : ""}`}
              onMouseEnter={() => setHovered(star)}
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                aria-label={`${star} sao - ${SENTIMENT_LABELS[star]}`}
              />
              <span aria-hidden="true">★</span>
            </label>
          ))}
        </div>
        <p className="rating-picker-label" aria-live="polite">
          {activeValue > 0
            ? `${activeValue}/5 · ${SENTIMENT_LABELS[activeValue] ?? ""}`
            : "Chọn số sao"}
        </p>
      </div>
    </fieldset>
  );
}

export function StarDisplay({ rating, size = 15 }: { rating: number; size?: number }) {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  return (
    <span
      aria-label={`${clamped}/5 sao`}
      style={{ color: "#f59e0b", fontSize: size, letterSpacing: "1px", lineHeight: 1 }}
    >
      {"★★★★★".slice(0, clamped)}{"☆☆☆☆☆".slice(0, 5 - clamped)}
    </span>
  );
}
