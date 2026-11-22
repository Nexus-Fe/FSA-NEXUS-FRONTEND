"use client";

import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { EMPTY_GHN_SELECTION, type GhnErrors, type GhnSelection } from "./ghn-address";
import { locationService } from "./location.service";

/**
 * Province, district and ward chosen from the GHN lists the back end serves, so the codes sent with an address are always real.
 * Changing a level clears the levels below it. A failed list shows an error with a retry rather than an empty select.
 */
export function GhnLocationSelect({
  value,
  onChange,
  errors = {},
  disabled = false,
}: {
  value: GhnSelection;
  onChange: (next: GhnSelection) => void;
  errors?: GhnErrors;
  disabled?: boolean;
}) {
  const provinces = useApiResource("ghn-provinces", (signal) => locationService.provinces(signal));
  const districts = useApiResource(value.provinceId ? `ghn-districts:${value.provinceId}` : null, (signal) => locationService.districts(value.provinceId as number, signal));
  const wards = useApiResource(value.districtId ? `ghn-wards:${value.districtId}` : null, (signal) => locationService.wards(value.districtId as number, signal));

  const failed = provinces.error ?? districts.error ?? wards.error;
  const retry = () => {
    if (provinces.error) provinces.reload();
    if (districts.error) districts.reload();
    if (wards.error) wards.reload();
  };

  return (
    <>
      <label className="field-wrap">
        <span>Tỉnh / Thành phố <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="province"
          required
          disabled={disabled || provinces.loading}
          value={value.provinceId ?? ""}
          aria-invalid={Boolean(errors.province)}
          onChange={(event) => {
            const id = Number(event.target.value);
            const found = provinces.data?.find((entry) => entry.provinceId === id);
            onChange(found ? { ...EMPTY_GHN_SELECTION, provinceId: found.provinceId, provinceName: found.provinceName } : EMPTY_GHN_SELECTION);
          }}
        >
          <option value="">{provinces.loading ? "Đang tải…" : "Chọn tỉnh / thành phố"}</option>
          {provinces.data?.map((entry) => <option key={entry.provinceId} value={entry.provinceId}>{entry.provinceName}</option>)}
        </select>
        {errors.province && <small className="checkout-field-error" role="alert">{errors.province}</small>}
      </label>
      <label className="field-wrap">
        <span>Quận / Huyện <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="district"
          required
          disabled={disabled || !value.provinceId || districts.loading}
          value={value.districtId ?? ""}
          aria-invalid={Boolean(errors.district)}
          onChange={(event) => {
            const id = Number(event.target.value);
            const found = districts.data?.find((entry) => entry.districtId === id);
            onChange({ ...value, districtId: found?.districtId ?? null, districtName: found?.districtName ?? "", wardCode: "", wardName: "" });
          }}
        >
          <option value="">{!value.provinceId ? "Chọn tỉnh / thành phố trước" : districts.loading ? "Đang tải…" : "Chọn quận / huyện"}</option>
          {districts.data?.map((entry) => <option key={entry.districtId} value={entry.districtId}>{entry.districtName}</option>)}
        </select>
        {errors.district && <small className="checkout-field-error" role="alert">{errors.district}</small>}
      </label>
      <label className="field-wrap">
        <span>Phường / Xã <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="ward"
          required
          disabled={disabled || !value.districtId || wards.loading}
          value={value.wardCode}
          aria-invalid={Boolean(errors.ward)}
          onChange={(event) => {
            const found = wards.data?.find((entry) => entry.wardCode === event.target.value);
            onChange({ ...value, wardCode: found?.wardCode ?? "", wardName: found?.wardName ?? "" });
          }}
        >
          <option value="">{!value.districtId ? "Chọn quận / huyện trước" : wards.loading ? "Đang tải…" : "Chọn phường / xã"}</option>
          {wards.data?.map((entry) => <option key={entry.wardCode} value={entry.wardCode}>{entry.wardName}</option>)}
        </select>
        {errors.ward && <small className="checkout-field-error" role="alert">{errors.ward}</small>}
      </label>
      {failed && (
        <p className="notice" role="alert">
          {formatError(describeError(failed, { operation: "read" }))}{" "}
          <button type="button" className="button button-secondary button-small" onClick={retry}>Tải lại danh sách</button>
        </p>
      )}
    </>
  );
}
