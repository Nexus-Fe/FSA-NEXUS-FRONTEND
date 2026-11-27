import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { Page } from "../finance/wallet-tools.service";

export type AuditRecord = { id: string; serviceName: string; entityName: string; entityId?: string | null; action: string; userId?: string | null; traceId?: string | null; createdAt: string; oldValues?: unknown; newValues?: unknown };
export type SyncSource = { serviceName: string; state: "Known" | "Unavailable" | "Unknown"; unsyncedCount?: number | null; lastKnownUnsyncedCount?: number | null; observedAt?: string | null; lastSuccessfulSyncAt?: string | null; lastError?: string | null };
export type SyncStatus = { enabled: boolean; services: SyncSource[] };
export type SecurityAlert = { id: string; rule: string; severity: string; status: string; description: string; auditLogId?: string | null; createdAt: string; resolvedBy?: string | null; resolvedAt?: string | null; resolutionNote?: string | null };
export type ServiceHealth = { serviceName: string; status: string; latencyMs?: number | null; checkedAt: string; message?: string | null; workers?: Array<{ name: string; status: string }> };
export type SystemHealth = { status: string; checkedAt: string; services: ServiceHealth[] };
function page<T>(value: Page<T>): Page<T> { if (!value || !Array.isArray(value.items) || !value.pagination || typeof value.pagination.totalCount !== "number") throw new Error("Dữ liệu không đúng định dạng."); return value; }
function query(filter: Record<string, string | number | undefined>) { const p = new URLSearchParams(); for (const [key, value] of Object.entries(filter)) if (value !== undefined && value !== "") p.set(key, String(value)); return p.toString(); }
export const operationsService = {
  auditLogs: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<AuditRecord>> | Page<AuditRecord>>(`/api/v1/admin/audit-logs?${query(filter)}`, { signal }))),
  auditLog: async (id: string) => unwrap(await api.get<ApiResponse<AuditRecord> | AuditRecord>(`/api/v1/admin/audit-logs/${encodeURIComponent(id)}`)),
  syncStatus: async (signal?: AbortSignal) => unwrap(await api.get<ApiResponse<SyncStatus> | SyncStatus>("/api/v1/admin/audit-logs/sync-status", { signal })),
  alerts: async (filter: Record<string, string | number | undefined>, signal?: AbortSignal) => page(unwrap(await api.get<ApiResponse<Page<SecurityAlert>> | Page<SecurityAlert>>(`/api/v1/admin/security-alerts?${query(filter)}`, { signal }))),
  closeAlert: async (id: string, note: string) => unwrap(await api.patch<ApiResponse<SecurityAlert> | SecurityAlert>(`/api/v1/admin/security-alerts/${encodeURIComponent(id)}`, { status: "Resolved", note })),
  health: async (signal?: AbortSignal) => unwrap(await api.get<ApiResponse<SystemHealth> | SystemHealth>("/api/v1/admin/system-health", { signal })),
};
