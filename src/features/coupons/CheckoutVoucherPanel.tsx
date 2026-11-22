"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useApiResource } from "@/lib/api/use-api-resource";
import { useFeature } from "@/lib/features/FeatureProvider";
import { formatMoney } from "@/lib/presentation";
import { LoadingState } from "@/components/ui/States";
import { discountService, type AvailableVoucher } from "./services/discount.service";
import { canSelectVoucher } from "./voucher-rules";
import { describeVoucherFailure, ineligibleText } from "./voucher-outcome";

type PanelProps = { cartItemIds: string[]; selectedCodes: string[]; disabled?: boolean; cashOnDelivery?: boolean; onChange: (codes: string[]) => void };

/** Real vouchers for the checkout. Shown only while the `vouchers` feature is on; the back end decides what is valid. */
export function CheckoutVoucherPanel(props: PanelProps) {
  const enabled = useFeature("vouchers");
  if (!enabled || !props.cartItemIds.length) return null;
  return <PanelContent {...props} />;
}

function PanelContent({ cartItemIds, selectedCodes, disabled = false, cashOnDelivery = false, onChange }: PanelProps) {
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = useApiResource(`checkout-vouchers:${cartItemIds.join(",")}`, (signal) => discountService.available(cartItemIds, signal));
  const vouchers = available.data?.items ?? [];
  const locked = busy || disabled;
  // Platform vouchers cannot be used with cash on delivery (the back end refuses them), so they are not offered then.
  const systemCodes = vouchers.filter((voucher) => voucher.scopeType === "System").map((voucher) => voucher.code);
  const heldSystemCodes = cashOnDelivery ? selectedCodes.filter((code) => systemCodes.includes(code)) : [];
  useEffect(() => {
    if (heldSystemCodes.length > 0) onChange(selectedCodes.filter((code) => !heldSystemCodes.includes(code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldSystemCodes.join(",")]);

  function toggle(item: AvailableVoucher) {
    setError("");
    if (cashOnDelivery && item.scopeType === "System") {
      setError("Mã của sàn không dùng được khi thanh toán khi nhận hàng (COD).");
      return;
    }
    if (selectedCodes.includes(item.code)) {
      onChange(selectedCodes.filter((code) => code !== item.code));
      return;
    }
    const issue = canSelectVoucher(vouchers.filter((voucher) => selectedCodes.includes(voucher.code)), item);
    if (issue) {
      setError(issue);
      return;
    }
    onChange([...selectedCodes, item.code]);
  }

  async function addManual(event: FormEvent) {
    event.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      const result = await discountService.validate(code, cartItemIds);
      if (!result.isValid) {
        setError(ineligibleText(result.ineligibleReason));
        return;
      }
      const item = vouchers.find((voucher) => voucher.code.toUpperCase() === code);
      if (item) toggle(item);
      else if (!selectedCodes.includes(code)) onChange([...selectedCodes, code]);
      setManualCode("");
    } catch (cause) {
      setError(describeVoucherFailure(cause));
    } finally {
      setBusy(false);
    }
  }

  async function recommend() {
    setBusy(true);
    setError("");
    try {
      const result = await discountService.recommend(cartItemIds);
      onChange([...result.recommendedVoucherCodes]);
    } catch (cause) {
      setError(describeVoucherFailure(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="checkout-voucher-panel" aria-label="Mã giảm giá">
      <div className="checkout-voucher-heading">
        <h3>Mã giảm giá</h3>
        <button className="button button-secondary button-small" type="button" disabled={locked} onClick={() => void recommend()}>
          Chọn mã tốt nhất
        </button>
      </div>
      {available.loading ? (
        <LoadingState rows={2} label="Đang tìm mã phù hợp…" />
      ) : available.error ? (
        <p role="alert">{describeVoucherFailure(available.error)}</p>
      ) : vouchers.length === 0 ? (
        <p>Chưa có mã dành cho giỏ hàng này.</p>
      ) : (
        <div className="checkout-voucher-list">
          {vouchers.map((voucher) => (
            <label key={voucher.id} className="checkout-voucher-option">
              <input
                type="checkbox"
                checked={selectedCodes.includes(voucher.code)}
                disabled={locked || (!voucher.isEligible && !selectedCodes.includes(voucher.code)) || (cashOnDelivery && voucher.scopeType === "System")}
                onChange={() => toggle(voucher)}
              />
              <span>
                <strong>{voucher.code}</strong>
                <small>
                  {voucher.name} · {voucher.discountType === "Percentage" ? `${voucher.discountValue}%` : formatMoney(voucher.discountValue)}
                  {voucher.minOrderAmount > 0 ? ` · Đơn từ ${formatMoney(voucher.minOrderAmount)}` : ""}
                </small>
                {!voucher.isEligible && <small className="form-error">{ineligibleText(voucher.ineligibleReason)}</small>}
                {cashOnDelivery && voucher.scopeType === "System" && <small className="form-error">Không dùng được khi thanh toán khi nhận hàng.</small>}
              </span>
              <b>{voucher.estimatedDiscountAmount > 0 ? `−${formatMoney(voucher.estimatedDiscountAmount)}` : ""}</b>
            </label>
          ))}
        </div>
      )}
      <form className="checkout-voucher-manual" onSubmit={(event) => void addManual(event)}>
        <input
          className="field"
          value={manualCode}
          disabled={locked}
          onChange={(event) => setManualCode(event.target.value)}
          placeholder="Nhập mã giảm giá"
          aria-label="Nhập mã giảm giá"
        />
        <button className="button button-secondary button-small" type="submit" disabled={locked || !manualCode.trim()}>
          Áp mã
        </button>
      </form>
      {selectedCodes.length > 0 && <p className="checkout-voucher-selected">Đã chọn: {selectedCodes.join(", ")}</p>}
      {error && (
        <p className="checkout-field-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
