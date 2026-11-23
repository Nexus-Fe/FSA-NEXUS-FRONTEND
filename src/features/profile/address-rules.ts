import type { GhnSelection } from "@/features/shipping/ghn-address";
import type { AddressInput, UserAddress } from "./services/address.service";

export type AddressFormValues = { recipientName: string; phone: string; label: string; addressLine: string; isDefault: boolean };
export type AddressFormErrors = Partial<Record<keyof AddressFormValues | "province" | "district" | "ward", string>>;

export const EMPTY_ADDRESS_FORM: AddressFormValues = { recipientName: "", phone: "", label: "", addressLine: "", isDefault: false };

/** Limits mirror the back end's validation (name 150, phone 30, label 60, address line 500) so a refusal is caught before sending. */
export function validateAddressBookForm(form: AddressFormValues, ghn: GhnSelection): AddressFormErrors {
  const errors: AddressFormErrors = {};
  if (!form.recipientName.trim()) errors.recipientName = "Nhập tên người nhận.";
  else if (form.recipientName.trim().length > 150) errors.recipientName = "Tên người nhận tối đa 150 ký tự.";
  if (!/^(0|\+84)\d{9,10}$/.test(form.phone.trim().replace(/[\s.-]/g, ""))) errors.phone = "Nhập số điện thoại Việt Nam hợp lệ, ví dụ 0901234567.";
  if (form.label.trim().length > 60) errors.label = "Nhãn tối đa 60 ký tự.";
  if (!form.addressLine.trim()) errors.addressLine = "Nhập địa chỉ cụ thể.";
  else if (form.addressLine.trim().length > 500) errors.addressLine = "Địa chỉ tối đa 500 ký tự.";
  if (!ghn.provinceId) errors.province = "Chọn tỉnh hoặc thành phố.";
  if (!ghn.districtId) errors.district = "Chọn quận hoặc huyện.";
  if (!ghn.wardCode) errors.ward = "Chọn phường hoặc xã.";
  return errors;
}

export function toAddressInput(form: AddressFormValues, ghn: GhnSelection): AddressInput {
  if (!ghn.provinceId || !ghn.districtId || !ghn.wardCode) throw new Error("GHN_SELECTION_INCOMPLETE");
  return {
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    label: form.label.trim() || null,
    provinceId: ghn.provinceId,
    provinceName: ghn.provinceName,
    districtId: ghn.districtId,
    districtName: ghn.districtName,
    wardCode: ghn.wardCode,
    wardName: ghn.wardName,
    addressLine: form.addressLine.trim(),
    isDefault: form.isDefault,
  };
}

export function toGhnSelection(address: UserAddress): GhnSelection {
  return {
    provinceId: address.provinceId,
    provinceName: address.provinceName,
    districtId: address.districtId,
    districtName: address.districtName,
    wardCode: address.wardCode,
    wardName: address.wardName,
  };
}

/** Default first, then newest first by id order the back end returns; stable for equal keys. */
export function sortAddresses(addresses: readonly UserAddress[]): UserAddress[] {
  return [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export function describeAddress(address: UserAddress): string {
  return [address.addressLine, address.wardName, address.districtName, address.provinceName].filter(Boolean).join(", ");
}
