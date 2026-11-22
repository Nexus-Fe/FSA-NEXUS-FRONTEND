/**
 * The shipping address the back end accepts. Commerce refuses any address without a GHN district id and ward code
 * (`INVALID_SHIPPING_ADDRESS`), so the ids always travel with the names.
 */
export type GhnSelection = {
  provinceId: number | null;
  provinceName: string;
  districtId: number | null;
  districtName: string;
  wardCode: string;
  wardName: string;
};

export const EMPTY_GHN_SELECTION: GhnSelection = { provinceId: null, provinceName: "", districtId: null, districtName: "", wardCode: "", wardName: "" };

export type GhnErrors = Partial<Record<"province" | "district" | "ward", string>>;

/** A selection is complete only when all three levels are chosen. */
export function validateGhnSelection(selection: GhnSelection): GhnErrors {
  const errors: GhnErrors = {};
  if (!selection.provinceId) errors.province = "Chọn tỉnh hoặc thành phố.";
  if (!selection.districtId) errors.district = "Chọn quận hoặc huyện.";
  if (!selection.wardCode) errors.ward = "Chọn phường hoặc xã.";
  return errors;
}

export type ShippingAddressPayload = {
  receiverName: string;
  contactPhone: string;
  street: string;
  ward: string;
  district: string;
  province: string;
  ghnDistrictId: number;
  ghnWardCode: string;
};

/** Builds the `shippingAddress` object of the quote, recalculate and change-address calls. Throws if the selection is incomplete. */
export function buildShippingAddress(input: { receiverName: string; phone: string; street: string }, selection: GhnSelection): ShippingAddressPayload {
  if (!selection.districtId || !selection.wardCode) throw new Error("GHN_SELECTION_INCOMPLETE");
  return {
    receiverName: input.receiverName.trim(),
    contactPhone: input.phone.trim(),
    street: input.street.trim(),
    ward: selection.wardName,
    district: selection.districtName,
    province: selection.provinceName,
    ghnDistrictId: selection.districtId,
    ghnWardCode: selection.wardCode,
  };
}

/** Single-line address stored with the order (`CreateOrderRequest.shippingAddress`). */
export function formatAddressLine(street: string, selection: GhnSelection): string {
  return [street.trim(), selection.wardName, selection.districtName, selection.provinceName].filter(Boolean).join(", ");
}

/** Reads a saved selection back from session storage, dropping anything malformed. */
export function parseGhnSelection(raw: string | null | undefined): GhnSelection {
  if (!raw) return EMPTY_GHN_SELECTION;
  try {
    const value = JSON.parse(raw) as Partial<GhnSelection>;
    const provinceId = typeof value.provinceId === "number" ? value.provinceId : null;
    const districtId = typeof value.districtId === "number" ? value.districtId : null;
    return {
      provinceId,
      provinceName: provinceId ? String(value.provinceName ?? "") : "",
      districtId: provinceId ? districtId : null,
      districtName: provinceId && districtId ? String(value.districtName ?? "") : "",
      wardCode: provinceId && districtId ? String(value.wardCode ?? "") : "",
      wardName: provinceId && districtId && value.wardCode ? String(value.wardName ?? "") : "",
    };
  } catch {
    return EMPTY_GHN_SELECTION;
  }
}
