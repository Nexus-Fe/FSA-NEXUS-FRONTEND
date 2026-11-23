"use client";

import { useState, type FormEvent } from "react";
import { formatMoney } from "@/lib/presentation";
import { findPreviewDraft, previewVouchers, savePreviewVoucher, useSavedPreviewVouchers } from "./preview-vouchers";

export function CheckoutVoucherPreview({ itemsAmount, shippingFee }: { itemsAmount: number; shippingFee: number | null }) {
  const savedCodes = useSavedPreviewVouchers();
  const [enteredCode, setEnteredCode] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [notice, setNotice] = useState("");
  const selected = previewVouchers.find((voucher) => voucher.code === selectedCode);
  const selectedDraft = selected ? null : findPreviewDraft(selectedCode);
  const basis = selected?.kind === "shipping" ? shippingFee : itemsAmount;
  const draftEligible = Boolean(selectedDraft && itemsAmount >= selectedDraft.minOrderAmount);
  const estimatedSaving = selected && basis !== null
    ? Math.round(basis * selected.percent / 100)
    : selectedDraft && draftEligible
      ? Math.min(selectedDraft.discountType === "PERCENTAGE" ? Math.round(itemsAmount * selectedDraft.discountValue / 100) : selectedDraft.discountValue, selectedDraft.maxDiscountAmount || Number.POSITIVE_INFINITY, itemsAmount)
      : null;

  function saveCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = enteredCode.trim().toUpperCase();
    if (!previewVouchers.some((voucher) => voucher.code === code) && !findPreviewDraft(code)) {
      setNotice("Mã này chưa có trong danh sách ưu đãi xem trước.");
      return;
    }
    if (savePreviewVoucher(code)) {
      setSelectedCode(code);
      setEnteredCode("");
      setNotice(`Đã lưu và chọn mã mẫu ${code}.`);
    } else {
      setNotice("Không lưu được mã trên trình duyệt này.");
    }
  }

  return <section className="checkout-voucher" aria-labelledby="checkout-voucher-title">
    <div className="checkout-voucher-heading"><h3 id="checkout-voucher-title">Mã giảm giá</h3><span>Bản xem trước</span></div>
    <form className="checkout-voucher-entry" onSubmit={saveCode}>
      <label className="sr-only" htmlFor="checkout-voucher-code">Nhập mã giảm giá mẫu</label>
      <input id="checkout-voucher-code" className="field" value={enteredCode} onChange={(event) => { setEnteredCode(event.target.value); setNotice(""); }} placeholder="Nhập mã từ banner" maxLength={32} />
      <button type="submit" className="button button-secondary button-small" disabled={!enteredCode.trim()}>Lưu mã</button>
    </form>
    {savedCodes.length > 0 && <div className="checkout-voucher-saved" role="group" aria-label="Mã đã lưu">
      {savedCodes.filter((code) => previewVouchers.some((voucher) => voucher.code === code) || findPreviewDraft(code)).map((code) =>
        <button key={code} type="button" className={`checkout-voucher-chip${selectedCode === code ? " is-selected" : ""}`} aria-pressed={selectedCode === code} onClick={() => { setSelectedCode(selectedCode === code ? "" : code); setNotice(""); }}>{code}</button>)}
    </div>}
    {(selected || selectedDraft) && <div className="checkout-voucher-estimate"><span>{selected?.title ?? (selectedDraft?.scope === "seller" ? "Voucher gian hàng mẫu" : "Voucher toàn sàn mẫu")}</span><strong>{estimatedSaving === null ? selectedDraft ? `Đơn tối thiểu ${formatMoney(selectedDraft.minOrderAmount)}` : "Có phí vận chuyển sẽ tính được" : `Ước tính tiết kiệm ${formatMoney(estimatedSaving)}`}</strong></div>}
    {selectedDraft?.scope === "seller" && <p className="checkout-voucher-disclaimer">Chưa kiểm tra điều kiện gian hàng vì đây là bản nháp giao diện.</p>}
    <p className="checkout-voucher-disclaimer">Mã mẫu chỉ minh họa giao diện, chưa trừ vào báo giá và không được gửi khi đặt hàng.</p>
    {notice && <p role="status" className="checkout-voucher-notice">{notice}</p>}
  </section>;
}
