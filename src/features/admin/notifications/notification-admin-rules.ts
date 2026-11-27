/** Notification management (`/api/v1/admin/notifications/templates|channels|deliveries`). Admin writes; staff reads. */
export type Template = { id: string; code: string; locale: string; notificationType: string; channelCode: string; subjectTemplate: string | null; bodyTemplate: string | null; isMandatory: boolean; isActive: boolean; updatedAt: string };
export type Channel = { id: string; code: string; name: string; provider: string | null; isDisabled: boolean; updatedAt: string };
export type Delivery = { id: string; notificationId: string; userId: string; channel: string; status: string; attemptCount: number; lastAttemptAt: string | null; nextRetryAt: string | null; errorCode: string | null; rowVersion: number; destinationHint: string; createdAt: string; updatedAt: string };
export type DeliveryLog = { id: string; action: string; level: string; message: string; attempt: number | null; errorCode: string | null; nextRetryAt: string | null; createdAt: string };
export type PageOf<T> = { items: T[]; pagination: { pageIndex: number; totalPages: number; totalCount: number; hasPreviousPage: boolean; hasNextPage: boolean } };

export const MAX_SUBJECT = 500;
export const MAX_BODY = 4000;
export const MAX_RETRY_REASON = 500;

export function asPage<T>(value: unknown): PageOf<T> {
  const raw = ((value as { data?: unknown } | null)?.data ?? value) as Partial<PageOf<T>> | null;
  const items = Array.isArray(raw?.items) ? (raw!.items as T[]) : [];
  const p = raw?.pagination;
  return { items, pagination: { pageIndex: p?.pageIndex ?? 1, totalPages: p?.totalPages ?? 1, totalCount: p?.totalCount ?? items.length, hasPreviousPage: Boolean(p?.hasPreviousPage), hasNextPage: Boolean(p?.hasNextPage) } };
}

export function validateTemplate(subject: string, body: string): string | null {
  if (!subject.trim()) return "Nhập tiêu đề mẫu.";
  if (!body.trim()) return "Nhập nội dung mẫu.";
  if (subject.length > MAX_SUBJECT) return `Tiêu đề tối đa ${MAX_SUBJECT} ký tự.`;
  if (body.length > MAX_BODY) return `Nội dung tối đa ${MAX_BODY} ký tự.`;
  return null;
}

/** Delivery states: Pending, Sending, Sent, Failed, Skipped. Only a Failed delivery is sent again by hand (the server also checks). */
export function canRetryDelivery(status: string): boolean {
  return status.trim().toUpperCase() === "FAILED";
}

export const DELIVERY_STATUS_LABEL: Readonly<Record<string, string>> = { PENDING: "Đang chờ gửi", SENDING: "Đang gửi", SENT: "Đã gửi", FAILED: "Gửi thất bại", SKIPPED: "Bỏ qua" };
export const deliveryStatusLabel = (status: string) => DELIVERY_STATUS_LABEL[status.trim().toUpperCase()] ?? status;

export function validateRetryReason(reason: string): string | null {
  if (!reason.trim()) return "Nhập lý do gửi lại.";
  if (reason.length > MAX_RETRY_REASON) return `Lý do tối đa ${MAX_RETRY_REASON} ký tự.`;
  return null;
}

/** The request id makes a retry safe to repeat: one id per opened dialog, reused if the answer never came. */
export function newRequestId(): string {
  return globalThis.crypto.randomUUID();
}
