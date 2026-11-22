"use client";

import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { useApiResource } from "@/lib/api/use-api-resource";
import { describeAddress, sortAddresses } from "./address-rules";
import { addressService, type UserAddress } from "./services/address.service";

/** Lets the buyer fill the checkout form from the address book. A failure here never blocks typing an address by hand. */
export function SavedAddressPicker({ onPick, disabled = false }: { onPick: (address: UserAddress) => void; disabled?: boolean }) {
  const addresses = useApiResource("checkout-address-book", (signal) => addressService.list(signal));
  const list = sortAddresses(addresses.data ?? []);
  if (addresses.loading || addresses.error) return null;
  if (list.length === 0) {
    return <p className="checkout-voucher-selected">Bạn chưa lưu địa chỉ nào. <Link href={ROUTES.auth.addresses}>Thêm vào sổ địa chỉ</Link></p>;
  }
  return (
    <label className="field-wrap">Chọn từ sổ địa chỉ
      <select className="field" defaultValue="" disabled={disabled} onChange={(event) => { const found = list.find((entry) => entry.id === event.target.value); if (found) onPick(found); }}>
        <option value="">Chọn một địa chỉ đã lưu</option>
        {list.map((entry) => <option key={entry.id} value={entry.id}>{(entry.isDefault ? "[Mặc định] " : "") + entry.recipientName + " · " + describeAddress(entry)}</option>)}
      </select>
    </label>
  );
}
