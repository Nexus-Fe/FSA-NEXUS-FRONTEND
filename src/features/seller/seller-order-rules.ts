export type SellerOrderTone = "sky" | "amber" | "green" | "red";

export function isCodPayment(method: string | null | undefined): boolean {
  return (method ?? "").trim().toUpperCase() === "COD";
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (isCodPayment(method)) return "COD";
  const key = (method ?? "").trim().toUpperCase();
  if (!key || key === "WALLET") return "Ví Nexus";
  return method!.trim();
}

/** BE lets a seller accept a Paid order, or a Cod order still in PendingPayment (which means "awaiting seller approval"). */
export function canSellerAccept(sub: { status: string; paymentMethod?: string | null }): boolean {
  const key = sub.status.replace(/[^a-z]/gi, "").toUpperCase();
  return key === "PAID" || key === "PENDINGCONFIRMATION" || (key === "PENDINGPAYMENT" && isCodPayment(sub.paymentMethod));
}

export function describeSellerOrderStatus(status: string, paymentMethod?: string | null): string {
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (key === "PENDINGPAYMENT" && isCodPayment(paymentMethod)) return "Chờ bạn xác nhận (COD)";
  if (key === "SELLERREJECTED" && isCodPayment(paymentMethod)) return "Đã từ chối";
  if (key === "COMPLETED" && isCodPayment(paymentMethod)) return "Hoàn tất · Đã thu hộ (COD)";
  return (
    (
      {
        PENDINGPAYMENT: "Chờ thanh toán",
        PAID: "Đã thanh toán · Chờ bạn xác nhận",
        PENDINGCONFIRMATION: "Chờ bạn xác nhận",
        PROCESSING: "Đang chuẩn bị hàng",
        CONFIRMED: "Đã xác nhận · Đã khởi tạo đơn hàng",
        SELLERACCEPTED: "Đã xác nhận · Đã khởi tạo đơn hàng",
        SHIPPING: "Đang giao hàng",
        SHIPPED: "Đang giao hàng",
        DELIVERED: "Đã giao · Chờ người mua xác nhận",
        COMPLETED: "Hoàn tất · Đã cộng tiền vào ví",
        SELLERREJECTED: "Đã từ chối · Đã hoàn tiền cho người mua",
        CANCELLED: "Đã hủy",
      } as Record<string, string>
    )[key] ?? status
  );
}

export function sellerOrderStatusTone(status: string, paymentMethod?: string | null): SellerOrderTone {
  const key = status.replace(/[^a-z]/gi, "").toUpperCase();
  if (key === "PENDINGPAYMENT" && isCodPayment(paymentMethod)) return "amber";
  if (key === "CONFIRMED" || key === "SELLERACCEPTED" || key === "PROCESSING") return "amber";
  if (key === "COMPLETED") return "green";
  if (key === "CANCELLED" || key === "SELLERREJECTED") return "red";
  return "sky";
}
