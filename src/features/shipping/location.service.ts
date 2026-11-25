import { api, unwrap, type ApiResponse } from "@/lib/api/client";

/** GHN location lists served by Fulfillment through the Gateway (`/api/v1/shipping/locations/*`, public). */
export type GhnProvince = { provinceId: number; provinceName: string; code?: string | null };
export type GhnDistrict = { districtId: number; provinceId: number; districtName: string; supportType?: number };
export type GhnWard = { wardCode: string; districtId: number; wardName: string };

function list<T>(raw: unknown, what: string): T[] {
  if (!Array.isArray(raw)) throw new Error(`Danh sách ${what} không đúng định dạng.`);
  return raw as T[];
}

/**
 * Where a list came from. The Gateway exposes the two headers the Fulfillment sets: "ghn" is a fresh GHN answer, "ghn-cache" an earlier GHN
 * answer still held in the cache. Anything else (header missing or unreadable) is "unknown" and is never trusted to say a code does not exist.
 */
export type LocationSource = "ghn" | "ghn-cache" | "unknown";
export type LocationList<T> = { items: T[]; source: LocationSource; observedAt: string | null };

async function load<T>(path: string, what: string, signal?: AbortSignal): Promise<LocationList<T>> {
  const { data, headers } = await api.getWithMetadata<ApiResponse<T[]> | T[]>(path, { signal });
  const header = headers.get("X-Location-Source");
  const source: LocationSource = header === "ghn" || header === "ghn-cache" ? header : "unknown";
  return { items: list<T>(unwrap(data), what), source, observedAt: headers.get("X-Location-Observed-At") };
}

export const locationService = {
  provinces(signal?: AbortSignal): Promise<LocationList<GhnProvince>> {
    return load<GhnProvince>("/api/v1/shipping/locations/provinces", "tỉnh/thành phố", signal);
  },
  districts(provinceId: number, signal?: AbortSignal): Promise<LocationList<GhnDistrict>> {
    return load<GhnDistrict>(`/api/v1/shipping/locations/districts?provinceId=${encodeURIComponent(String(provinceId))}`, "quận/huyện", signal);
  },
  wards(districtId: number, signal?: AbortSignal): Promise<LocationList<GhnWard>> {
    return load<GhnWard>(`/api/v1/shipping/locations/wards?districtId=${encodeURIComponent(String(districtId))}`, "phường/xã", signal);
  },
};
