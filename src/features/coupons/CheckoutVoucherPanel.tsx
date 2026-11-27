"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useApiResource } from "@/lib/api/use-api-resource";
import { useFeature } from "@/lib/features/FeatureProvider";
import { formatMoney } from "@/lib/presentation";
import { LoadingState } from "@/components/ui/States";
import { discountService, type AvailableVoucher } from "./services/discount.service";
import { canSelectVoucher } from "./voucher-rules";
import type { VoucherCalcInput } from "./voucher-calculator";
import { describeVoucherFailure, ineligibleText } from "./voucher-outcome";

type PanelProps = {
  cartItemIds: string[];
  selectedCodes: string[];
  disabled?: boolean;
  cashOnDelivery?: boolean;
  onChange: (codes: string[]) => void;
  onVouchersChange?: (vouchers: VoucherCalcInput[]) => void;
};

/** Real vouchers for the checkout. Shown only while the `vouchers` feature is on; the back end decides what is valid. */
export function CheckoutVoucherPanel(props: PanelProps) {
  const enabled = useFeature("vouchers");
  if (!enabled || !props.cartItemIds.length) return null;
  return <PanelContent {...props} />;
}

function PanelContent({
  cartItemIds,
  selectedCodes,
  disabled = false,
  cashOnDelivery = false,
  onChange,
  onVouchersChange,
}: PanelProps) {
  const [manualCode, setManualCode] = useState("");
  const [manualVouchers, setManualVouchers] = useState<Record<string, VoucherCalcInput>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const available = useApiResource(`checkout-vouchers:${cartItemIds.join(",")}`, (signal) => discountService.available(cartItemIds, signal));
  const vouchers = useMemo(() => available.data?.items ?? [], [available.data?.items]);
  const locked = busy || disabled;

  const selectedVouchers = useMemo<VoucherCalcInput[]>(() => {
    const resolved: VoucherCalcInput[] = [];
    for (const code of selectedCodes) {
      const upper = code.toUpperCase();
      const found = vouchers.find((v) => v.code.toUpperCase() === upper);
      if (found) {
        resolved.push(found);
      } else if (manualVouchers[upper]) {
        resolved.push(manualVouchers[upper]);
      }
    }
    return resolved;
  }, [selectedCodes, vouchers, manualVouchers]);

  const lastSyncedRef = useRef("");
  const onVouchersChangeRef = useRef(onVouchersChange);
  useEffect(() => {
    onVouchersChangeRef.current = onVouchersChange;
  }, [onVouchersChange]);

  useEffect(() => {
    const signature = JSON.stringify(selectedVouchers);
    if (lastSyncedRef.current === signature) return;
    lastSyncedRef.current = signature;
    onVouchersChangeRef.current?.(selectedVouchers);
  }, [selectedVouchers]);

  // Platform vouchers cannot be used with cash on delivery (the back end refuses them), so they are not offered then.
  const systemCodes = vouchers
    .filter((voucher) => voucher.scopeType === "System")
    .map((voucher) => voucher.code.toUpperCase());
  const heldSystemCodes = cashOnDelivery
    ? selectedCodes.filter((code) => {
        const upper = code.toUpperCase();
        return systemCodes.includes(upper) || manualVouchers[upper]?.scopeType === "System";
      })
    : [];
  useEffect(() => {
    if (heldSystemCodes.length > 0) {
      onChange(selectedCodes.filter((code) => !heldSystemCodes.includes(code)));
    }
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
    const issue = canSelectVoucher(selectedVouchers, item);
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
      if (item) {
        toggle(item);
      } else {
        const scopeType = result.scopeType ?? "System";
        if (cashOnDelivery && scopeType === "System") {
          setError("Mã của sàn không dùng được khi thanh toán khi nhận hàng (COD).");
          return;
        }
        const candidate: VoucherCalcInput = {
          code,
          scopeType,
          estimatedDiscountAmount: result.estimatedDiscountAmount ?? 0,
        };
        const issue = canSelectVoucher(selectedVouchers, candidate);
        if (issue) {
          setError(issue);
          return;
        }
        setManualVouchers((prev) => ({ ...prev, [code]: candidate }));
        if (!selectedCodes.some((c) => c.toUpperCase() === code)) {
          onChange([...selectedCodes, code]);
        }
      }
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
      const nextCodes = cashOnDelivery
        ? result.recommendedVoucherCodes.filter((code) => {
            const matched = vouchers.find((v) => v.code.toUpperCase() === code.toUpperCase());
            return matched ? matched.scopeType !== "System" : true;
          })
        : result.recommendedVoucherCodes;
      onChange([...nextCodes]);
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
          {([
            { scope: "Product" as const, title: "Voucher sản phẩm", hint: "Trừ trước theo sản phẩm" },
            { scope: "Shop" as const, title: "Voucher của shop", hint: "Trừ sau sản phẩm (chỉ chọn 1 mã SP hoặc Shop)" },
            { scope: "System" as const, title: "Voucher toàn sàn", hint: "Trừ cuối cùng trên phần còn lại" },
          ]).map((group) => {
            const groupItems = vouchers.filter((voucher) => voucher.scopeType === group.scope);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.scope} className="checkout-voucher-group">
                <div className="checkout-voucher-group-title">
                  <strong>{group.title}</strong>
                  <small>{group.hint}</small>
                </div>
                {groupItems.map((voucher) => {
                  const isSelected = selectedCodes.includes(voucher.code);
                  const codBlocked = cashOnDelivery && voucher.scopeType === "System";
                  const conflictReason =
                    !isSelected && !codBlocked && voucher.isEligible
                      ? canSelectVoucher(selectedVouchers, voucher)
                      : null;
                  const optionDisabled =
                    locked ||
                    (!voucher.isEligible && !isSelected) ||
                    codBlocked ||
                    Boolean(conflictReason);
                  return (
                    <label
                      key={voucher.id}
                      className={`checkout-voucher-option${isSelected ? " is-selected" : ""}${optionDisabled ? " is-disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={optionDisabled}
                        onChange={() => toggle(voucher)}
                      />
                      <span>
                        <strong>{voucher.code}</strong>
                        <small>
                          {voucher.name} · {voucher.discountType === "Percentage" ? `${voucher.discountValue}%` : formatMoney(voucher.discountValue)}
                          {voucher.minOrderAmount > 0 ? ` · Đơn từ ${formatMoney(voucher.minOrderAmount)}` : ""}
                        </small>
                        {!voucher.isEligible && <small className="form-error">{ineligibleText(voucher.ineligibleReason)}</small>}
                        {codBlocked && <small className="form-error">Không dùng được khi thanh toán khi nhận hàng.</small>}
                        {conflictReason && <small className="checkout-voucher-blocked">{conflictReason}</small>}
                      </span>
                      <b>{voucher.estimatedDiscountAmount > 0 ? `−${formatMoney(voucher.estimatedDiscountAmount)}` : ""}</b>
                    </label>
                  );
                })}
              </div>
            );
          })}
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
