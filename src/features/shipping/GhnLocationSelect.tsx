"use client";

import { useEffect, useState } from "react";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeError, formatError } from "@/lib/errors/error-messages";
import { EMPTY_GHN_SELECTION, GHN_STALE_MESSAGE, checkGhnSelection, clearGhnFrom, fillGhnNames, type GhnCheck, type GhnErrors, type GhnLevel, type GhnSelection } from "./ghn-address";
import { locationService } from "./location.service";

/**
 * Province, district and ward chosen from the GHN lists the back end serves, so the codes sent with an address are always real.
 * Changing a level clears the levels below it. A failed list shows an error with a retry rather than an empty select.
 *
 * A selection that arrives with codes already set (a saved address, a draft) is checked against the lists once they load:
 * - the names are filled in from the lists when the saved address carries only codes;
 * - a code that a trusted GHN list (from GHN or its cache) does not contain is cleared with the levels below it, and the user is told to choose again;
 * - when the lists fail, or their origin is not known to be GHN, nothing is cleared: the address is kept and the user can retry.
 * `onCheck` reports the result so a form can wait for it.
 */
export function GhnLocationSelect({
  value,
  onChange,
  errors = {},
  disabled = false,
  onCheck,
}: {
  value: GhnSelection;
  /** `source` is "user" when the person chose something and "auto" when the select itself filled in names or cleared a stale code. */
  onChange: (next: GhnSelection, source?: "user" | "auto") => void;
  errors?: GhnErrors;
  disabled?: boolean;
  onCheck?: (check: GhnCheck) => void;
}) {
  const provinces = useApiResource("ghn-provinces", (signal) => locationService.provinces(signal));
  const provinceConfirmed =
    Boolean(value.provinceId) &&
    Boolean(provinces.data) &&
    (provinces.data!.source === "unknown" || provinces.data!.items.some((entry) => entry.provinceId === value.provinceId));
  const districts = useApiResource(provinceConfirmed ? `ghn-districts:${value.provinceId}` : null, (signal) => locationService.districts(value.provinceId as number, signal));
  const districtConfirmed =
    Boolean(value.districtId) &&
    Boolean(districts.data) &&
    (districts.data!.source === "unknown" || districts.data!.items.some((entry) => entry.districtId === value.districtId));
  const wards = useApiResource(districtConfirmed ? `ghn-wards:${value.districtId}` : null, (signal) => locationService.wards(value.districtId as number, signal));

  const failed = provinces.error ?? districts.error ?? wards.error;
  const noDistricts = Boolean(value.provinceId) && !districts.loading && !districts.error && Boolean(districts.data) && districts.data!.items.length === 0;
  const noWards = Boolean(value.districtId) && !wards.loading && !wards.error && Boolean(wards.data) && wards.data!.items.length === 0;

  const check = checkGhnSelection(value, {
    provinces: provinces.data,
    districts: value.provinceId ? districts.data : null,
    wards: value.districtId ? wards.data : null,
    failed: Boolean(failed),
  });
  const [staleLevel, setStaleLevel] = useState<GhnLevel | null>(null);
  const checkState = check.state === "stale" ? `stale:${check.level}` : check.state;
  // Remembered while rendering (not in an effect) so the notice shows in the same pass that clears the stale level.
  if (check.state === "stale" && staleLevel !== check.level) setStaleLevel(check.level);

  useEffect(() => {
    onCheck?.(check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkState]);

  useEffect(() => {
    if (check.state === "stale") {
      onChange(clearGhnFrom(value, check.level), "auto");
      return;
    }
    if (check.state === "valid") {
      const named = fillGhnNames(value, { provinces: provinces.data, districts: districts.data, wards: wards.data });
      if (named) onChange(named, "auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkState, provinces.data, districts.data, wards.data, value.provinceId, value.districtId, value.wardCode]);
  const retry = () => {
    if (provinces.error || !provinces.data || provinces.data.source === "unknown") provinces.reload();
    if (provinceConfirmed && (districts.error || !districts.data || districts.data.source === "unknown")) districts.reload();
    if (districtConfirmed && (wards.error || !wards.data || wards.data.source === "unknown")) wards.reload();
  };

  return (
    <>
      <label className="field-wrap">
        <span>Tỉnh / Thành phố <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="province"
          required
          disabled={disabled || provinces.loading || Boolean(provinces.error)}
          value={value.provinceId ?? ""}
          aria-invalid={Boolean(errors.province)}
          onChange={(event) => {
            const id = Number(event.target.value);
            const found = provinces.data?.items.find((entry) => entry.provinceId === id);
            onChange(found ? { ...EMPTY_GHN_SELECTION, provinceId: found.provinceId, provinceName: found.provinceName } : EMPTY_GHN_SELECTION, "user");
          }}
        >
          <option value="">{provinces.loading ? "Đang tải…" : provinces.error ? "Không tải được tỉnh / thành phố" : "Chọn tỉnh / thành phố"}</option>
          {provinces.data?.items.map((entry) => <option key={entry.provinceId} value={entry.provinceId}>{entry.provinceName}</option>)}
        </select>
        {errors.province && <small className="checkout-field-error" role="alert">{errors.province}</small>}
      </label>
      <label className="field-wrap">
        <span>Quận / Huyện <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="district"
          required
          disabled={disabled || !value.provinceId || districts.loading || Boolean(districts.error) || noDistricts}
          value={value.districtId ?? ""}
          aria-invalid={Boolean(errors.district)}
          onChange={(event) => {
            const id = Number(event.target.value);
            const found = districts.data?.items.find((entry) => entry.districtId === id);
            onChange({ ...value, districtId: found?.districtId ?? null, districtName: found?.districtName ?? "", wardCode: "", wardName: "" }, "user");
          }}
        >
          <option value="">{!value.provinceId ? "Chọn tỉnh / thành phố trước" : districts.loading ? "Đang tải…" : districts.error ? "Không tải được quận / huyện" : noDistricts ? "Không có quận / huyện khả dụng" : "Chọn quận / huyện"}</option>
          {districts.data?.items.map((entry) => <option key={entry.districtId} value={entry.districtId}>{entry.districtName}</option>)}
        </select>
        {errors.district && <small className="checkout-field-error" role="alert">{errors.district}</small>}
      </label>
      <label className="field-wrap">
        <span>Phường / Xã <abbr className="checkout-required" title="Bắt buộc">*</abbr></span>
        <select
          className="field"
          name="ward"
          required
          disabled={disabled || !value.districtId || wards.loading || Boolean(wards.error) || noWards}
          value={value.wardCode}
          aria-invalid={Boolean(errors.ward)}
          onChange={(event) => {
            const found = wards.data?.items.find((entry) => entry.wardCode === event.target.value);
            onChange({ ...value, wardCode: found?.wardCode ?? "", wardName: found?.wardName ?? "" }, "user");
          }}
        >
          <option value="">{!value.districtId ? "Chọn quận / huyện trước" : wards.loading ? "Đang tải…" : wards.error ? "Không tải được phường / xã" : noWards ? "Quận / huyện này chưa có phường / xã" : "Chọn phường / xã"}</option>
          {wards.data?.items.map((entry) => <option key={entry.wardCode} value={entry.wardCode}>{entry.wardName}</option>)}
        </select>
        {errors.ward && <small className="checkout-field-error" role="alert">{errors.ward}</small>}
      </label>
      {!failed && (noDistricts || noWards) && (
        <p className="notice" role="status">
          {noWards
            ? "Quận / huyện này chưa có dữ liệu phường / xã từ GHN. Vui lòng chọn quận / huyện khác."
            : "Tỉnh / thành phố này chưa có dữ liệu quận / huyện từ GHN. Vui lòng chọn tỉnh / thành phố khác."}
        </p>
      )}
      {staleLevel && (staleLevel === "province" ? !value.provinceId : staleLevel === "district" ? !value.districtId : !value.wardCode) && (
        <p className="notice" role="alert" data-testid="ghn-stale-notice">{GHN_STALE_MESSAGE[staleLevel]}</p>
      )}
      {!failed && check.state === "unverifiable" && (
        <p className="notice" role="alert">
          Chưa xác nhận được nguồn danh sách GHN nên địa chỉ chưa được xác minh. Địa chỉ của bạn vẫn được giữ nguyên.{" "}
          <button type="button" className="button button-secondary button-small" onClick={retry}>Tải lại danh sách</button>
        </p>
      )}
      {failed && (
        <p className="notice" role="alert">
          {formatError(describeError(failed, { operation: "read" }))}{" "}
          <button type="button" className="button button-secondary button-small" onClick={retry}>Tải lại danh sách</button>
        </p>
      )}
    </>
  );
}
