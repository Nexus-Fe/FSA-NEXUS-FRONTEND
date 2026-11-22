import { api, unwrap, type ApiResponse } from "@/lib/api/client";

/** GHN location lists served by Fulfillment through the Gateway (`/api/v1/shipping/locations/*`, public). */
export type GhnProvince = { provinceId: number; provinceName: string; code?: string | null };
export type GhnDistrict = { districtId: number; provinceId: number; districtName: string; supportType?: number };
export type GhnWard = { wardCode: string; districtId: number; wardName: string };

function list<T>(raw: unknown, what: string): T[] {
  if (!Array.isArray(raw)) throw new Error(`Danh sách ${what} không đúng định dạng.`);
  return raw as T[];
}

export const locationService = {
  async provinces(signal?: AbortSignal): Promise<GhnProvince[]> {
    return list<GhnProvince>(unwrap(await api.get<ApiResponse<GhnProvince[]> | GhnProvince[]>("/api/v1/shipping/locations/provinces", { signal })), "tỉnh/thành phố");
  },
  async districts(provinceId: number, signal?: AbortSignal): Promise<GhnDistrict[]> {
    return list<GhnDistrict>(unwrap(await api.get<ApiResponse<GhnDistrict[]> | GhnDistrict[]>(`/api/v1/shipping/locations/districts?provinceId=${encodeURIComponent(String(provinceId))}`, { signal })), "quận/huyện");
  },
  async wards(districtId: number, signal?: AbortSignal): Promise<GhnWard[]> {
    return list<GhnWard>(unwrap(await api.get<ApiResponse<GhnWard[]> | GhnWard[]>(`/api/v1/shipping/locations/wards?districtId=${encodeURIComponent(String(districtId))}`, { signal })), "phường/xã");
  },
};
