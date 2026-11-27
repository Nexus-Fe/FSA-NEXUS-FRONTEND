/** Warehouse movement book (`GET /api/v1/inventories/ledgers`) and its spreadsheet export (`.../ledgers/export`). */
export type LedgerRow = { id: string; skuId: string; movementType: string; quantity: number; referenceType: string | null; referenceId: string | null; note: string | null; createdAt: string; warehouseName: string | null };
export type LedgerSummary = { totalInboundQuantity: number; totalOutboundQuantity: number; netChange: number; totalTransactions: number };
export type LedgerPage = { summary: LedgerSummary | null; rows: LedgerRow[]; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };

type Nested = { items?: LedgerRow[]; pagination?: { totalPages?: number; hasNextPage?: boolean; hasPreviousPage?: boolean } };

/** The answer nests the page: `{ summary, items: { items, pagination } }`. Anything else is an empty page. */
export function asLedgerPage(value: unknown): LedgerPage {
  const raw = ((value as { data?: unknown } | null)?.data ?? value) as { summary?: LedgerSummary; items?: Nested | LedgerRow[] } | null;
  const nested: Nested | undefined = Array.isArray(raw?.items) ? { items: raw.items } : (raw?.items as Nested | undefined);
  return {
    summary: raw?.summary ?? null,
    rows: Array.isArray(nested?.items) ? nested.items : [],
    totalPages: nested?.pagination?.totalPages ?? 1,
    hasNextPage: Boolean(nested?.pagination?.hasNextPage),
    hasPreviousPage: Boolean(nested?.pagination?.hasPreviousPage),
  };
}

export const MOVEMENT_LABEL: Readonly<Record<string, string>> = { INTAKE: "Nhập kho", ADJUST: "Điều chỉnh", RESERVE: "Giữ hàng", RELEASE: "Nhả hàng giữ", COMMIT: "Xuất kho", RETURN: "Nhập hàng hoàn", INITIALIZE: "Khai báo tồn" };
export const movementLabel = (type: string) => MOVEMENT_LABEL[type.trim().toUpperCase()] ?? type;

export type LedgerFilter = { movementType?: string; fromDate?: string; toDate?: string; search?: string };

/** The query shared by the list and the export, so the file always matches the screen. Empty values are left out. */
export function ledgerQuery(filter: LedgerFilter, page?: number): string {
  const params = new URLSearchParams();
  if (page) { params.set("page", String(page)); params.set("pageSize", "20"); }
  if (filter.movementType) params.set("movementType", filter.movementType);
  if (filter.fromDate) params.set("fromDate", new Date(`${filter.fromDate}T00:00:00`).toISOString());
  if (filter.toDate) params.set("toDate", new Date(`${filter.toDate}T23:59:59`).toISOString());
  if (filter.search?.trim()) params.set("search", filter.search.trim());
  return params.toString();
}

export function exportFileName(serverName: string | null): string {
  return serverName && /\.xlsx$/i.test(serverName) ? serverName : "so_cai_kho.xlsx";
}
