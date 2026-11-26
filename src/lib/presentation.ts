export function resolveImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl, "http://local.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === "http://local.invalid" ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return null;
  }
}

export function formatMoney(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "Chưa có dữ liệu" : new Intl.NumberFormat("vi-VN").format(value) + " ₫";
}

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang bán",
  DRAFT: "Bản nháp",
  PENDINGAPPROVAL: "Chờ duyệt",
  PENDING_APPROVAL: "Chờ duyệt",
  INACTIVE: "Tạm ngưng",
  REJECTED: "Bị từ chối",
  SUSPENDED: "Bị đình chỉ",
};

export function describeProductStatus(status?: string | null, statusReason?: string | null): string {
  return sellerProductStatusBadge(status, statusReason).label;
}

export function sellerProductStatusBadge(
  status?: string | null,
  statusReason?: string | null,
): { label: string; tone: "slate" | "green" | "amber" | "red" } {
  const s = (status ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  const r = (statusReason ?? "").toUpperCase().replace(/[^A-Z]/g, "");
  if (s === "DRAFT" && r === "REJECTED") return { label: "Bị từ chối", tone: "red" };
  if (s === "INACTIVE" && r === "ADMINLOCKED") return { label: "Bị đình chỉ", tone: "red" };
  if (s === "ACTIVE") return { label: "Đang bán", tone: "green" };
  if (s === "PENDINGAPPROVAL") return { label: "Chờ duyệt", tone: "amber" };
  if (s === "REJECTED") return { label: "Bị từ chối", tone: "red" };
  if (s === "SUSPENDED") return { label: "Bị đình chỉ", tone: "red" };
  if (s === "DRAFT") return { label: "Bản nháp", tone: "slate" };
  if (s === "INACTIVE") return { label: "Tạm ngưng", tone: "slate" };
  return { label: status ? (PRODUCT_STATUS_LABELS[status.toUpperCase()] ?? status) : "—", tone: "slate" };
}
