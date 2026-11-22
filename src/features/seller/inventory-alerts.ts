/** Rules for the seller's stock alerts (`GET /inventories/alerts/low-stock`, `.../dead-stock`, `PUT /inventories/{skuId}/threshold`). Both lists are plain arrays, not paged. */
export type LowStockAlert = { skuId: string; warehouseId: string; availableQuantity: number; totalQuantity: number; reservedQuantity: number; minStockThreshold: number; lastMovementAt: string };
export type DeadStockAlert = { skuId: string; warehouseId: string; availableQuantity: number; totalQuantity: number; lastMovementAt: string; daysWithoutMovement: number };

export const MAX_THRESHOLD = 1_000_000;
export const DEAD_STOCK_DAY_OPTIONS = [30, 60, 90] as const;

/** Accepts a plain array or an enveloped `{ data: [...] }`; anything else is an empty list. */
export function asAlertList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const inner = (value as { data?: unknown } | null)?.data;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

/** The threshold the server accepts is a whole number from 0 to 1,000,000. Returns the number or an error text. */
export function parseThreshold(text: string): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return { error: "Nhập số nguyên từ 0 trở lên." };
  const value = Number(trimmed);
  if (value > MAX_THRESHOLD) return { error: `Ngưỡng tối đa là ${MAX_THRESHOLD.toLocaleString("vi-VN")}.` };
  return { value };
}

/** Most urgent first: the emptier the stock is against its threshold, the higher it sits. */
export function sortLowStock(items: readonly LowStockAlert[]): LowStockAlert[] {
  return [...items].sort((a, b) => (a.availableQuantity - a.minStockThreshold) - (b.availableQuantity - b.minStockThreshold));
}
