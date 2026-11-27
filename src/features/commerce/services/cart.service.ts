import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { normalizeValidation, type CartValidation } from "../cart-rules";

export type CartShopGroup = { sellerId: string; shopName: string; distinctItemCount: number; totalQuantity: number; shopSubtotal: number };

export const cartService = {
  /** Shop names for the cart groups (`GET /carts/me/grouped`). */
  async shops(signal?: AbortSignal): Promise<Record<string, string>> {
    const raw = unwrap(await api.get<ApiResponse<{ shops?: CartShopGroup[] }> | { shops?: CartShopGroup[] }>("/api/v1/carts/me/grouped", { signal }));
    return Object.fromEntries((raw?.shops ?? []).map((shop) => [shop.sellerId, shop.shopName]));
  },
  async validate(selectedItemIds: string[]): Promise<CartValidation> {
    return normalizeValidation(unwrap(await api.post<ApiResponse<unknown> | unknown>("/api/v1/carts/me/validate", { selectedItemIds })));
  },
  async bulkRemove(cartItemIds: string[]): Promise<void> {
    await api.post("/api/v1/carts/me/items:bulk-remove", { cartItemIds, clearAll: false });
  },
  async clear(): Promise<void> {
    await api.delete("/api/v1/carts/me/clear");
  },
  async changeVariant(cartItemId: string, newSkuId: string): Promise<void> {
    await api.patch(`/api/v1/carts/me/items/${encodeURIComponent(cartItemId)}/variant`, { newSkuId });
  },
};
