import { ApiError } from "@/lib/api/client";

export function describeLookupFailure(error: unknown, objectName: string, notFoundCodes: readonly string[] = []): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Bạn không có quyền xem thông tin này.";
    if (error.status === 404) {
      if (error.errorCode && notFoundCodes.includes(error.errorCode)) return `Không tìm thấy ${objectName}.`;
      return `Không tải được ${objectName} (HTTP 404). Hãy thử lại; nếu vẫn lỗi, báo quản trị viên${error.traceId ? ` với mã vết ${error.traceId}` : ""}.`;
    }
    return `Không tải được ${objectName}${error.errorCode ? ` (${error.errorCode})` : ""}. Hãy thử lại.`;
  }
  return `Không tải được ${objectName}. Hãy thử lại.`;
}
