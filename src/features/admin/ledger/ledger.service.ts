import { api, unwrap, type ApiResponse } from "@/lib/api/client";

export type Page<T> = { items: T[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number } };
export type LedgerEntry = { transactionId: string; walletId: string; type: string; amount: number; currency: string; balanceBefore: number; balanceAfter: number; status: string; referenceId?: string | null; createdAt: string };
export type BalanceCheck = { walletId: string; currency: string; currentBalance: number; latestSuccessfulBalance?: number | null; difference?: number | null; successfulTransactionCount: number; latestTransactionAt?: string | null; result: string };
export type ReconciliationRun = { id: string; createdAt: string; status: string; findingCount: number; unavailableSources?: string[]; invariants?: string[] };
export type Finding = { id: string; invariantCode: string; severity: string; status: string; expectedValue?: string | number | null; actualValue?: string | number | null; referenceId?: string | null; source?: string | null; createdAt: string; note?: string | null };
export type JournalEntry = { id: string; transactionId: string; account: string; debit: number; credit: number; createdAt: string };
export type TrialBalance = { accounts: Array<{ account: string; totalDebit: number; totalCredit: number }>; totalDebit: number; totalCredit: number };
export type LedgerStatus = { enabled: boolean; shadowEpoch?: number; version?: number; updatedAt?: string; wallets?: Array<{ walletId: string; historyMissingCount: number; historyStatus: string; livePendingCount: number; liveFailedCount: number; i10Result: string; i10Reason?: string }> ; matchedCount?: number; mismatchedCount?: number; uncheckedCount?: number };

function page<T>(value: Page<T>): Page<T> { if (!value || !Array.isArray(value.items) || !value.pagination || typeof value.pagination.totalCount !== "number") throw new Error("Dữ liệu phân trang không đúng định dạng."); return value; }
function query(input: Record<string, string | number | undefined | null>) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(input)) if (value !== "" && value != null) params.set(key, String(value)); return params.toString(); }
const root = "/api/v1/admin/wallets";
export const ledgerService = {
  ledger: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<LedgerEntry>> | Page<LedgerEntry>>(`${root}/ledger?${query(filter)}`, { signal }))),
  balances: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<BalanceCheck>> | Page<BalanceCheck>>(`${root}/reconciliation?${query(filter)}`, { signal }))),
  runs: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<ReconciliationRun>> | Page<ReconciliationRun>>(`${root}/reconciliation/runs?${query(filter)}`, { signal }))),
  startRun: async (input: { fromDate?: string; toDate?: string; invariants?: string[] }) => unwrap(await api.post<ApiResponse<ReconciliationRun> | ReconciliationRun>(`${root}/reconciliation/runs`, input)),
  findings: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<Finding>> | Page<Finding>>(`${root}/reconciliation/findings?${query(filter)}`, { signal }))),
  finding: async (id: string) => unwrap(await api.get<ApiResponse<Finding> | Finding>(`${root}/reconciliation/findings/${encodeURIComponent(id)}`)),
  updateFinding: async (id: string, status: string, note: string) => unwrap(await api.patch<ApiResponse<Finding> | Finding>(`${root}/reconciliation/findings/${encodeURIComponent(id)}`, { status, note })),
  journal: async (transactionId?: string, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<JournalEntry>> | Page<JournalEntry>>(`${root}/ledger/journal?${query({ transactionId, page: 1, pageSize: 50 })}`, { signal }))),
  trialBalance: async (signal?: AbortSignal) => unwrap(await api.get<ApiResponse<TrialBalance> | TrialBalance>(`${root}/ledger/trial-balance`, { signal })),
  status: async (signal?: AbortSignal) => unwrap(await api.get<ApiResponse<LedgerStatus> | LedgerStatus>(`${root}/ledger/status`, { signal })),
  setShadow: async (enabled: boolean, expectedVersion: number) => unwrap(await api.put<ApiResponse<{ enabled: boolean; shadowEpoch: number; version: number; changed: boolean }> | { enabled: boolean; shadowEpoch: number; version: number; changed: boolean }>(`${root}/ledger/shadow`, { enabled, expectedVersion })),
  backfill: async (walletId?: string) => unwrap(await api.post<ApiResponse<{ walletsBackfilled: number; walletsSkipped: number; entriesCreated: number }> | { walletsBackfilled: number; walletsSkipped: number; entriesCreated: number }>(`${root}/ledger/backfill`, walletId ? { walletId } : {})),
};
