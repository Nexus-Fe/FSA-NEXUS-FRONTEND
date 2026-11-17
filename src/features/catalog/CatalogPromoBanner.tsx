"use client";

import { useState } from "react";
import { SwipeCarousel } from "@/components/ui/SwipeCarousel";
import { previewVouchers, savePreviewVoucher, useSavedPreviewVouchers } from "@/features/coupons/preview-vouchers";

export function CatalogPromoBanner() {
  const savedCodes = useSavedPreviewVouchers();
  const [notice, setNotice] = useState("");

  const saveCode = (code: string) => {
    if (savedCodes.includes(code)) return;
    if (savePreviewVoucher(code)) {
      setNotice(`Đã lưu mã ${code} trên trình duyệt này. Mã mẫu chưa áp dụng được khi thanh toán.`);
    } else {
      setNotice("Không lưu được mã trên trình duyệt này. Vui lòng thử lại.");
    }
  };

  return <section className="catalog-promo" aria-label="Ưu đãi xem trước">
    <SwipeCarousel slides={[...previewVouchers]} className="catalog-promo-carousel" ariaLabel="Vuốt ngang để xem các ưu đãi" renderSlide={(promotion, index, isClone) =>
      <article key={`${promotion.id}-${index}`} className={`catalog-promo-slide catalog-promo-${promotion.tone}`} aria-hidden={isClone || undefined}>
        <div className="catalog-promo-copy">
          <span className="catalog-promo-eyebrow">Ưu đãi xem trước</span>
          <h2><strong>{promotion.amount}</strong> {promotion.title}</h2>
          <p>{promotion.detail} · Chưa áp dụng thanh toán</p>
        </div>
        <div className="catalog-promo-action">
          <span className="catalog-promo-code">{promotion.code}</span>
          <button type="button" className="button button-primary button-small" disabled={isClone || savedCodes.includes(promotion.code)} tabIndex={isClone ? -1 : undefined} onClick={() => saveCode(promotion.code)}>{savedCodes.includes(promotion.code) ? "Đã lưu" : "Lưu mã"}</button>
        </div>
      </article>
    } />
    <p className="catalog-promo-notice" role="status" aria-live="polite">{notice}</p>
  </section>;
}
