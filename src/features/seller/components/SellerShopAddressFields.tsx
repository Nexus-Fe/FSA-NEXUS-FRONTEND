"use client";

import { useState } from "react";
import { GhnLocationSelect } from "@/features/shipping/GhnLocationSelect";
import { EMPTY_GHN_SELECTION, type GhnSelection } from "@/features/shipping/ghn-address";
import { locationService } from "@/features/shipping/location.service";
import { useApiResource } from "@/lib/api/use-api-resource";

/** The shop profile keeps only the GHN codes; the select needs a selection, so the codes are turned into one (names are filled in from the lists). */
function selectionFromCodes(provinceId: string, districtId: string, wardCode: string): GhnSelection {
  const province = Number(provinceId) > 0 ? Number(provinceId) : null;
  const district = province && Number(districtId) > 0 ? Number(districtId) : null;
  return { ...EMPTY_GHN_SELECTION, provinceId: province, districtId: district, wardCode: province && district ? wardCode.trim() : "" };
}

/**
 * Pickup address of the shop: province, district and ward come from the GHN lists, like every other address form. The three codes are sent
 * under the same field names as before (`provinceId`, `districtId`, `wardCode`), so the save of the shop profile does not change.
 * A saved code that GHN no longer lists is cleared with the levels below it and the user is asked to choose again (see GhnLocationSelect);
 * the form cannot be saved until the three levels are chosen, because the selects are required.
 */
export function SellerShopAddressFields({ provinceId, districtId, wardCode, streetAddress }: {
  provinceId: string;
  districtId: string;
  wardCode: string;
  streetAddress: string;
}) {
  const [selection, setSelection] = useState<GhnSelection>(() => selectionFromCodes(provinceId, districtId, wardCode));

  // The profile can arrive after the form first renders, or be reloaded after a save: take the new codes when they change.
  const parentCodes = `${provinceId}|${districtId}|${wardCode}`;
  const [seenParentCodes, setSeenParentCodes] = useState(parentCodes);
  if (seenParentCodes !== parentCodes) {
    setSeenParentCodes(parentCodes);
    setSelection(selectionFromCodes(provinceId, districtId, wardCode));
  }

  return <>
    <h3>Địa chỉ lấy hàng</h3>
    <div className="form-grid">
      <GhnLocationSelect value={selection} onChange={setSelection} />
      <input type="hidden" name="provinceId" value={selection.provinceId ?? ""} />
      <input type="hidden" name="districtId" value={selection.districtId ?? ""} />
      <input type="hidden" name="wardCode" value={selection.wardCode} />
      <label className="field-wrap" htmlFor="seller-shop-street">Địa chỉ cụ thể
        <input id="seller-shop-street" className="field" name="streetAddress" required defaultValue={streetAddress} />
      </label>
    </div>
  </>;
}

/** The saved pickup area as names. When GHN cannot confirm the codes it shows them as codes and does not call them wrong. */
export function SavedShopArea({ provinceId, districtId, wardCode }: { provinceId: string; districtId: string; wardCode: string }) {
  const province = Number(provinceId) > 0 ? Number(provinceId) : null;
  const district = Number(districtId) > 0 ? Number(districtId) : null;
  const provinces = useApiResource(province ? "ghn-provinces" : null, (signal) => locationService.provinces(signal));
  const districts = useApiResource(province && district ? `ghn-districts:${province}` : null, (signal) => locationService.districts(province as number, signal));
  const wards = useApiResource(district && wardCode ? `ghn-wards:${district}` : null, (signal) => locationService.wards(district as number, signal));

  if (!province) return <>—</>;
  const names = [
    provinces.data?.items.find((entry) => entry.provinceId === province)?.provinceName,
    districts.data?.items.find((entry) => entry.districtId === district)?.districtName,
    wards.data?.items.find((entry) => entry.wardCode === wardCode)?.wardName,
  ].filter(Boolean);
  if (names.length === (district ? (wardCode ? 3 : 2) : 1)) return <>{names.join(" · ")}</>;
  return <>{provinces.loading || districts.loading || wards.loading ? "Đang tải…" : `Mã GHN ${province}/${district ?? "—"}/${wardCode || "—"} (chưa xác nhận được tên)`}</>;
}
