export const ruleLabel: Record<string, string> = { BalanceTampering: "Điều chỉnh số dư bất thường", PrivilegeEscalation: "Nâng quyền", MassDelete: "Xóa hàng loạt", SuspiciousLogin: "Đăng nhập đáng ngờ", RateLimitExceeded: "Vượt giới hạn truy cập" };
export const severityLabel: Record<string, string> = { Low: "Thấp", Medium: "Trung bình", High: "Cao", Critical: "Nghiêm trọng" };
export const healthLabel: Record<string, string> = { Healthy: "Bình thường", Degraded: "Suy giảm", Unhealthy: "Không hoạt động" };
function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function jsonDiff(before: unknown, after: unknown): Array<{ key: string; before: unknown; after: unknown; changed: boolean }> {
  const a = objectValue(before);
  const b = objectValue(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().map((key) => ({ key, before: a[key], after: b[key], changed: JSON.stringify(a[key]) !== JSON.stringify(b[key]) }));
}
const sensitive = /password|secret|token|accountnumber|bankaccount|privatekey/i;
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, sensitive.test(key) ? "Đã che" : redact(nested)]));
  return value;
}
export function safeAuditValue(key: string, value: unknown): string { if (sensitive.test(key)) return "Đã che"; if (value == null) return "—"; if (typeof value === "string") { try { const parsed = JSON.parse(value); return JSON.stringify(redact(parsed)); } catch { return value; } } return JSON.stringify(redact(value)); }
