/** Rules for the account screens: login sessions, notification preferences, seller registration documents, reputation history. */
import { REPUTATION_CHANGE_REASON, statusLabel } from "@/lib/status-labels";

export type ActiveSession = { sessionId: string; deviceInfo: string | null; ipAddress: string | null; lastActiveAt: string; isCurrent: boolean };
export type PreferenceRow = { id: string | null; notificationType: string; channelCode: string; isDisabled: boolean; isMandatory: boolean; isDefault: boolean; isChannelDisabled: boolean };
export type ReputationHistoryRow = { logId: string; targetRole: string; changeAmount: number; scoreAfter: number; reason: string; referenceType: string | null; referenceId: string | null; note: string | null; createdAt: string };
export type ReputationPolicy = {
  enforcementEnabled: boolean; initialScore: number; minScore: number; maxScore: number; minScoreToBid: number; minScoreToSell: number;
  paymentTimeoutPenalty: number; sellerCancelPenalty: number; orderCompletedReward: number; antiFarmingCooldownDays: number;
  trustLevels?: Array<Record<string, unknown>>;
};

/** A paged or bare array answer becomes a plain list; anything else is an empty list. */
export function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const inner = (value as { items?: unknown; data?: unknown } | null);
  if (Array.isArray(inner?.items)) return inner!.items as T[];
  if (Array.isArray(inner?.data)) return inner!.data as T[];
  if (Array.isArray((inner?.data as { items?: unknown } | undefined)?.items)) return (inner!.data as { items: T[] }).items;
  return [];
}

/** Other sessions first would hide the one in use, so the current session leads and the rest follow by latest activity. */
export function sortSessions(items: readonly ActiveSession[]): ActiveSession[] {
  return [...items].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt));
}

export function otherSessionCount(items: readonly ActiveSession[]): number {
  return items.filter((item) => !item.isCurrent).length;
}

/** Mandatory notices (payment, security, one-time codes) cannot be switched off, and neither can a channel the platform has disabled. */
export function canToggle(row: PreferenceRow): boolean {
  return !row.isMandatory && !row.isChannelDisabled;
}

export function preferenceKey(row: { notificationType: string; channelCode: string }): string {
  return `${row.notificationType}:${row.channelCode}`;
}

/** Only the rows the person changed are sent (the server accepts 1 to 100 items). */
export function changedPreferences(original: readonly PreferenceRow[], edited: ReadonlyMap<string, boolean>): Array<{ notificationType: string; channelCode: string; isDisabled: boolean }> {
  const result: Array<{ notificationType: string; channelCode: string; isDisabled: boolean }> = [];
  for (const row of original) {
    const next = edited.get(preferenceKey(row));
    if (next !== undefined && next !== row.isDisabled && canToggle(row)) result.push({ notificationType: row.notificationType, channelCode: row.channelCode, isDisabled: next });
  }
  return result;
}

export const KYC_MAX_BYTES = 5 * 1024 * 1024;
const KYC_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

/** Identity card images and the optional business licence: JPG, PNG or PDF, at most 5 MB each (the server checks again, including the content). */
export function validateKycFile(file: { name: string; size: number } | null | undefined, required: boolean): string | null {
  if (!file) return required ? "Chọn tệp." : null;
  if (file.size <= 0) return "Tệp trống.";
  if (file.size > KYC_MAX_BYTES) return "Tệp tối đa 5 MB.";
  const lower = file.name.toLowerCase();
  if (!KYC_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "Chỉ nhận JPG, PNG hoặc PDF.";
  return null;
}

export function reputationReasonLabel(reason: string): string {
  return statusLabel(REPUTATION_CHANGE_REASON, reason);
}

export function signedPoints(amount: number): string {
  return amount > 0 ? `+${amount}` : String(amount);
}
