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

// ---- Checking a saved selection against the lists GHN gave -------------------------------------------------------------------------------

export type GhnLevel = "province" | "district" | "ward";

type ListLike<T> = { items: T[]; source: string } | null | undefined;

/** The lists loaded so far for one selection. `failed` is true when any of the three requests ended in an error. */
export type GhnLists = {
  provinces?: ListLike<{ provinceId: number }>;
  districts?: ListLike<{ districtId: number; provinceId: number }>;
  wards?: ListLike<{ wardCode: string; districtId: number }>;
  failed?: boolean;
};

/**
 * - empty: nothing chosen. pending: lists still loading. valid: every chosen level is in the GHN list of its parent.
 * - unverifiable: the lists failed, or their origin is not known to be GHN. The address is kept and the user may retry; it is NOT called wrong.
 * - stale: a trusted GHN list was loaded in full and the chosen code is not in it (or belongs to another parent).
 */
export type GhnCheck = { state: "empty" | "pending" | "valid" | "unverifiable" } | { state: "stale"; level: GhnLevel };

const trusted = (list: { source: string }) => list.source === "ghn" || list.source === "ghn-cache";

export function checkGhnSelection(value: GhnSelection, lists: GhnLists): GhnCheck {
  if (!value.provinceId) return { state: "empty" };
  const wait = (): GhnCheck => ({ state: lists.failed ? "unverifiable" : "pending" });

  if (!lists.provinces) return wait();
  if (!trusted(lists.provinces)) return { state: "unverifiable" };
  if (!lists.provinces.items.some((entry) => entry.provinceId === value.provinceId)) return { state: "stale", level: "province" };
  if (!value.districtId) return { state: "valid" };

  if (!lists.districts) return wait();
  if (!trusted(lists.districts)) return { state: "unverifiable" };
  if (!lists.districts.items.some((entry) => entry.districtId === value.districtId && entry.provinceId === value.provinceId)) return { state: "stale", level: "district" };
  if (!value.wardCode) return { state: "valid" };

  if (!lists.wards) return wait();
  if (!trusted(lists.wards)) return { state: "unverifiable" };
  if (!lists.wards.items.some((entry) => entry.wardCode === value.wardCode && entry.districtId === value.districtId)) return { state: "stale", level: "ward" };
  return { state: "valid" };
}

/** Drops the stale level and everything below it; the levels above it are kept. */
export function clearGhnFrom(value: GhnSelection, level: GhnLevel): GhnSelection {
  if (level === "province") return EMPTY_GHN_SELECTION;
  if (level === "district") return { ...value, districtId: null, districtName: "", wardCode: "", wardName: "" };
  return { ...value, wardCode: "", wardName: "" };
}

/** Names for the codes a saved address carries, read from the lists. Returns null when there is nothing to fill in. */
export function fillGhnNames(
  value: GhnSelection,
  lists: {
    provinces?: { items: { provinceId: number; provinceName: string }[] } | null;
    districts?: { items: { districtId: number; districtName: string }[] } | null;
    wards?: { items: { wardCode: string; wardName: string }[] } | null;
  },
): GhnSelection | null {
  const provinceName = lists.provinces?.items.find((entry) => entry.provinceId === value.provinceId)?.provinceName;
  const districtName = lists.districts?.items.find((entry) => entry.districtId === value.districtId)?.districtName;
  const wardName = lists.wards?.items.find((entry) => entry.wardCode === value.wardCode)?.wardName;
  const next: GhnSelection = {
    ...value,
    provinceName: provinceName ?? value.provinceName,
    districtName: districtName ?? value.districtName,
    wardName: wardName ?? value.wardName,
  };
  return next.provinceName === value.provinceName && next.districtName === value.districtName && next.wardName === value.wardName ? null : next;
}

export const GHN_STALE_MESSAGE: Record<GhnLevel, string> = {
  province: "Tỉnh / thành phố đã lưu không còn trong danh sách GHN. Địa chỉ cần cập nhật, hãy chọn lại.",
  district: "Quận / huyện đã lưu không còn trong danh sách GHN. Địa chỉ cần cập nhật, hãy chọn lại.",
  ward: "Phường / xã đã lưu không còn trong danh sách GHN. Địa chỉ cần cập nhật, hãy chọn lại.",
};

/** A selection built from the three codes a saved address or draft carries (names are filled in later from the lists). */
export function selectionFromCodes(provinceId: string | number | null | undefined, districtId: string | number | null | undefined, wardCode: string | null | undefined): GhnSelection {
  const province = Number(provinceId) > 0 ? Number(provinceId) : null;
  const district = province && Number(districtId) > 0 ? Number(districtId) : null;
  return { ...EMPTY_GHN_SELECTION, provinceId: province, districtId: district, wardCode: province && district ? String(wardCode ?? "").trim() : "" };
}

/**
 * A write (quote, save, submit) needs the CURRENT codes to be confirmed by a trusted GHN list: only "valid" passes. Returns the reason
 * it does not, or undefined when it does.
 */
export function ghnWriteBlock(check: GhnCheck): string | undefined {
  switch (check.state) {
    case "valid": return undefined;
    case "pending": return "Đang xác minh địa chỉ với GHN, hãy thử lại sau giây lát.";
    case "unverifiable": return "Chưa xác minh được địa chỉ vì danh sách GHN tạm thời không khả dụng. Hãy bấm Tải lại danh sách rồi thử lại.";
    case "stale": return GHN_STALE_MESSAGE[check.level];
    default: return "Chọn tỉnh, quận và phường cho địa chỉ.";
  }
}
