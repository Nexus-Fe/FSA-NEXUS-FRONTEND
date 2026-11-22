import { api, unwrap, type ApiResponse } from "@/lib/api/client";

/** One entry of the buyer's address book (`/api/v1/me/addresses`, UserService). The ids and codes are GHN's, as Commerce requires. */
export type UserAddress = {
  id: string;
  userId: string;
  recipientName: string;
  phone: string;
  label?: string | null;
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressLine: string;
  isDefault: boolean;
};

export type AddressInput = Omit<UserAddress, "id" | "userId">;

function listOf(raw: unknown): UserAddress[] {
  const value = unwrap(raw as ApiResponse<unknown> | unknown);
  const items = Array.isArray(value) ? value : (value as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) throw new Error("Dữ liệu sổ địa chỉ không đúng định dạng.");
  return items as UserAddress[];
}

export const addressService = {
  async list(signal?: AbortSignal): Promise<UserAddress[]> {
    return listOf(await api.get<unknown>("/api/v1/me/addresses", { signal }));
  },
  async create(input: AddressInput): Promise<UserAddress> {
    return unwrap(await api.post<ApiResponse<UserAddress> | UserAddress>("/api/v1/me/addresses", input));
  },
  async update(id: string, input: AddressInput): Promise<UserAddress> {
    return unwrap(await api.put<ApiResponse<UserAddress> | UserAddress>(`/api/v1/me/addresses/${encodeURIComponent(id)}`, input));
  },
  async setDefault(id: string): Promise<void> {
    await api.patch(`/api/v1/me/addresses/${encodeURIComponent(id)}/default`, {});
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/v1/me/addresses/${encodeURIComponent(id)}`);
  },
};
