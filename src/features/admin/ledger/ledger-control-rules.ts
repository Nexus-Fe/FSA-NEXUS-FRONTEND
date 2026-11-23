/** Shadow ledger switch (`PUT /admin/wallets/ledger/shadow {enabled, expectedVersion}`) and backfill (`POST .../ledger/backfill`). */
export type ShadowStatus = { enabled: boolean; version?: number } | null | undefined;

/** What the single button should do next, with the version the screen read. No status or no version means no switch is offered. */
export function shadowSwitchTarget(status: ShadowStatus): { enable: boolean; expectedVersion: number } | null {
  if (!status || typeof status.version !== "number") return null;
  return { enable: !status.enabled, expectedVersion: status.version };
}

export function describeShadowResult(result: { enabled: boolean; changed: boolean } | null | undefined): string {
  if (!result) return "Đã gửi yêu cầu.";
  if (!result.changed) return result.enabled ? "Sổ bóng đã bật từ trước, không có thay đổi." : "Sổ bóng đã tắt từ trước, không có thay đổi.";
  return result.enabled ? "Đã bật sổ bóng." : "Đã tắt sổ bóng.";
}

export function describeBackfill(result: { walletsBackfilled: number; walletsSkipped: number; entriesCreated: number } | null | undefined): string {
  if (!result) return "Đã gửi yêu cầu ghi bù.";
  return `Đã ghi bù ${result.walletsBackfilled} ví (${result.entriesCreated} bút toán). Bỏ qua ${result.walletsSkipped} ví chưa chứng minh được lịch sử.`;
}
