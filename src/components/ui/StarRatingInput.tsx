"use client";

import { useId } from "react";

export function StarRatingInput({ label = "Số sao", value, onChange }: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const name = useId();

  return <fieldset className="rating-picker">
    <legend>{label}</legend>
    <div className="rating-picker-options">
      {[1, 2, 3, 4, 5].map((star) => <label className={star <= value ? "rating-picker-star is-selected" : "rating-picker-star"} key={star}>
        <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} aria-label={`${star} sao`} />
        <span aria-hidden="true">★</span>
      </label>)}
    </div>
    <p aria-live="polite">{value > 0 ? `${value}/5 sao` : "Chọn số sao"}</p>
  </fieldset>;
}
