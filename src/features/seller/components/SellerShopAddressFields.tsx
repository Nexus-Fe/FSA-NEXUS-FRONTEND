"use client";

import { useState } from "react";
import { SelectBox } from "@/components/ui/SelectBox";
import { ghnPresets } from "../ghn-presets";

export function SellerShopAddressFields({ provinceId, districtId, wardCode, streetAddress }: {
  provinceId: string;
  districtId: string;
  wardCode: string;
  streetAddress: string;
}) {
  const [selectedProvince, setSelectedProvince] = useState(provinceId);
  const [selectedDistrict, setSelectedDistrict] = useState(districtId);
  const [selectedWard, setSelectedWard] = useState(wardCode);
  const provinces = [...new Map(ghnPresets.map((place) => [place.provinceId, place.city])).entries()];
  const districts = [...new Map(ghnPresets.filter((place) => place.provinceId === selectedProvince)
    .map((place) => [place.districtId, place.district])).entries()];
  const wards = ghnPresets.filter((place) => place.provinceId === selectedProvince && place.districtId === selectedDistrict);
  const existingProvince = selectedProvince && !provinces.some(([id]) => id === selectedProvince);
  const existingDistrict = selectedDistrict && !districts.some(([id]) => id === selectedDistrict);
  const existingWard = selectedWard && !wards.some((place) => place.wardCode === selectedWard);

  return <>
    <h3>Địa chỉ lấy hàng</h3>
    <div className="form-grid">
      <label className="field-wrap" htmlFor="seller-shop-province">Tỉnh / thành phố
        <SelectBox
          id="seller-shop-province"
          name="provinceId"
          ariaLabel="Tỉnh / thành phố"
          value={selectedProvince}
          placeholder="Chọn tỉnh / thành phố"
          options={[
            ...(existingProvince ? [{ value: selectedProvince, label: "Khu vực đã lưu" }] : []),
            ...provinces.map(([id, city]) => ({ value: id, label: city })),
          ]}
          onChange={(next) => { setSelectedProvince(next); setSelectedDistrict(""); setSelectedWard(""); }}
        />
      </label>
      <label className="field-wrap" htmlFor="seller-shop-district">Quận / huyện
        <SelectBox
          id="seller-shop-district"
          name="districtId"
          ariaLabel="Quận / huyện"
          value={selectedDistrict}
          disabled={!selectedProvince}
          placeholder="Chọn quận / huyện"
          options={[
            ...(existingDistrict ? [{ value: selectedDistrict, label: "Quận / huyện đã lưu" }] : []),
            ...districts.map(([id, district]) => ({ value: id, label: district })),
          ]}
          onChange={(next) => { setSelectedDistrict(next); setSelectedWard(""); }}
        />
      </label>
      <label className="field-wrap" htmlFor="seller-shop-ward">Phường / xã
        <SelectBox
          id="seller-shop-ward"
          name="wardCode"
          ariaLabel="Phường / xã"
          value={selectedWard}
          disabled={!selectedDistrict}
          placeholder="Chọn phường / xã"
          options={[
            ...(existingWard ? [{ value: selectedWard, label: "Phường / xã đã lưu" }] : []),
            ...wards.map((place) => ({ value: place.wardCode, label: place.ward })),
          ]}
          onChange={setSelectedWard}
        />
      </label>
      <label className="field-wrap" htmlFor="seller-shop-street">Địa chỉ cụ thể
        <input id="seller-shop-street" className="field" name="streetAddress" required defaultValue={streetAddress} />
      </label>
    </div>
    <p className="status-note">Danh sách chọn nhanh hiện có 4 khu vực GHN mẫu.</p>
  </>;
}
