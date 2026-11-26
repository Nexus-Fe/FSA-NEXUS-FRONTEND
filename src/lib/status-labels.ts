/**
 * Vietnamese labels for the status values the back end sends, in one place.
 *
 * Keys are normalised (upper case, no spaces, underscores, hyphens or brackets), so `UnderReview`, `UNDER_REVIEW` and `under-review`
 * are the same key. A value with no label is shown as it arrived rather than hidden, and `isKnownStatus` tells a screen about it.
 * Tables follow the real enums: Commerce (OrderStatus, SubOrderStatus, RefundStatus), Fulfillment (ShipmentStatus), Wallet
 * (WithdrawalStatus, WalletTransactionType, SubsidyBudgetStatus, ReconciliationFindingStatus), User (ReportStatus, ReportRefundStatus,
 * ReputationChangeReason) and Catalog (ReportStatus). User and Catalog each define their own ReportStatus, hence both spellings below.
 */
export type StatusTable = Readonly<Record<string, string>>;

export function normalizeStatus(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[\s_\-[\]]/g, "");
}

function build(entries: Record<string, string>): StatusTable {
  return Object.fromEntries(Object.entries(entries).map(([key, label]) => [normalizeStatus(key), label]));
}

export function statusLabel(table: StatusTable, value: string | null | undefined): string {
  if (!value) return "—";
  return table[normalizeStatus(value)] ?? value;
}

export function isKnownStatus(table: StatusTable, value: string | null | undefined): boolean {
  return Boolean(value) && normalizeStatus(value) in table;
}

/** Commerce `OrderStatus`. */
export const ORDER_STATUS: StatusTable = build({
  PendingPayment: "Chờ thanh toán",
  PaymentProcessing: "Đang xử lý thanh toán",
  Paid: "Đã thanh toán",
  Cancelled: "Đã hủy",
  Expired: "Đã hết hạn thanh toán",
  Completed: "Hoàn tất",
  Delivered: "Đã giao",
});

/** Commerce `SubOrderStatus` (`Confirmed` = `SellerAccepted`, `Shipping` = `Shipped`). */
export const SUB_ORDER_STATUS: StatusTable = build({
  PendingPayment: "Chờ thanh toán",
  Paid: "Đã thanh toán, chờ người bán xác nhận",
  Confirmed: "Chờ lấy hàng",
  SellerAccepted: "Chờ lấy hàng",
  Shipping: "Đang giao hàng",
  Shipped: "Đang giao hàng",
  Delivered: "Đã giao hàng",
  Completed: "Hoàn tất",
  Cancelled: "Đã hủy",
  Refunded: "Đã hoàn tiền",
});

/** Commerce `AuctionOrderStatus`. */
export const AUCTION_ORDER_STATUS: StatusTable = build({
  AwaitingPayment: "Chờ thanh toán",
  PendingPayment: "Chờ thanh toán",
  Pending: "Chờ thanh toán",
  Paid: "Đã thanh toán, chờ người bán xác nhận",
  Confirmed: "Chờ lấy hàng",
  SellerAccepted: "Chờ lấy hàng",
  Shipping: "Đang giao hàng",
  Shipped: "Đang giao hàng",
  Delivered: "Đã giao hàng",
  Completed: "Hoàn tất",
  Cancelled: "Đã hủy",
  Canceled: "Đã hủy",
  Expired: "Hết hạn thanh toán",
  Refunded: "Đã hoàn tiền",
  Returning: "Đang hoàn hàng",
  Returned: "Đã hoàn hàng",
});

/**
 * Fulfillment `ShipmentStatus`, plus the bracketed tokens the sub-order timeline writes from historical reasons (`[Returning]`).
 * An order or sub-order never carries these values; they belong to the shipment and its timeline.
 */
export const SHIPMENT_STATUS: StatusTable = build({
  ReadyToPick: "Chờ lấy hàng",
  Picking: "Đang lấy hàng",
  Packed: "Đã đóng gói",
  HandedOver: "Đã bàn giao cho đơn vị vận chuyển",
  InTransit: "Đang vận chuyển",
  Delivered: "Đã giao thành công",
  DeliveryFailed: "Giao không thành công",
  Returning: "Đang hoàn hàng về người bán",
  Returned: "Đã hoàn hàng về người bán",
  Cancelled: "Vận đơn đã hủy",
});

/** Commerce `RefundStatus`. */
export const REFUND_STATUS: StatusTable = build({
  Requested: "Đã yêu cầu hoàn tiền",
  WalletPending: "Đã duyệt, đang chờ ví xác nhận",
  Completed: "Đã hoàn tiền",
  Failed: "Hoàn tiền thất bại",
  Rejected: "Yêu cầu hoàn tiền bị từ chối",
});

/** User `ReportRefundStatus`: the refund that follows a resolved order report. */
export const REPORT_REFUND_STATUS: StatusTable = build({
  None: "Không hoàn tiền",
  Pending: "Chờ hoàn tiền",
  Refunded: "Đã hoàn tiền",
  ManualProcessingRequired: "Cần nhân viên xử lý thủ công",
  Failed: "Hoàn tiền thất bại",
});

/**
 * Report status for BOTH services: User (`Pending`, `UnderReview`, `Resolved`, `Rejected`) and Catalog (`Pending`, `Investigating`,
 * `Resolved`, `Dismissed`). One table so a report screen never shows two different words for the same state.
 */
export const REPORT_STATUS: StatusTable = build({
  Pending: "Chờ xử lý",
  UnderReview: "Đang xem xét",
  Investigating: "Đang xem xét",
  Resolved: "Đã xử lý",
  Rejected: "Đã từ chối",
  Dismissed: "Đã từ chối",
});

/**
 * Wallet `WithdrawalStatus`. `Approved` is approved but NOT yet paid out, so it must never read as "transferred"; only `Completed` does.
 */
export const WITHDRAWAL_STATUS: StatusTable = build({
  Pending: "Chờ duyệt",
  Approved: "Đã duyệt, chờ chuyển khoản",
  Processing: "Đang xử lý chuyển khoản",
  Completed: "Đã chuyển tiền",
  Rejected: "Bị từ chối",
  Failed: "Chuyển tiền thất bại",
  Cancelled: "Đã hủy",
});

/** Wallet `WalletTransactionType`, including the settlement V2 movements. */
export const WALLET_TRANSACTION_TYPE: StatusTable = build({
  TopupVnpay: "Nạp tiền (VNPay)",
  TopupStripe: "Nạp tiền (Stripe)",
  PurchaseDebit: "Thanh toán đơn hàng",
  RefundCredit: "Hoàn tiền đơn hàng",
  // EscrowCredit has no description in the Wallet docs; the label stays neutral rather than guess who receives it.
  EscrowCredit: "Tiền đơn hàng vào ví giữ (escrow)",
  EscrowRelease: "Giải ngân tiền bán hàng",
  EscrowCancellationRefund: "Hoàn tiền đang giữ do hủy đơn",
  WithdrawalDebit: "Rút tiền",
  WithdrawalReversal: "Hoàn lại tiền rút",
  PlatformFeeCredit: "Phí nền tảng",
  PlatformSubsidyCredit: "Trợ giá từ sàn",
  AdjustmentCredit: "Điều chỉnh tăng số dư",
  AdjustmentDebit: "Điều chỉnh giảm số dư",
  DirectGatewayPayment: "Thanh toán trực tiếp qua cổng",
  TransferIn: "Nhận tiền chuyển",
  TransferOut: "Chuyển tiền đi",
  AuctionHoldCapture: "Trừ tiền cọc vào đơn đấu giá",
  AuctionForfeitCredit: "Nhận tiền cọc bị mất",
  AuctionDepositRefund: "Hoàn tiền cọc đấu giá",
  OrderPaymentAdjustmentDebit: "Điều chỉnh tăng số tiền đơn hàng",
  OrderPaymentAdjustmentRefund: "Hoàn chênh lệch số tiền đơn hàng",
});

/** Wallet `SubsidyBudgetStatus`. */
export const SUBSIDY_BUDGET_STATUS: StatusTable = build({
  PendingApproval: "Chờ duyệt",
  Active: "Đang hoạt động",
  Closed: "Đã đóng",
});

/** Wallet `ReconciliationFindingStatus`. */
export const RECONCILIATION_FINDING_STATUS: StatusTable = build({
  Open: "Đang mở",
  Investigating: "Đang điều tra",
  Resolved: "Đã xử lý",
  Accepted: "Đã chấp nhận",
});

/** User `ReputationChangeReason`. */
export const REPUTATION_CHANGE_REASON: StatusTable = build({
  PositiveReview: "Nhận đánh giá tốt",
  NegativeReview: "Nhận đánh giá xấu",
  OrderCompleted: "Hoàn tất đơn hàng",
  AuctionPaymentTimeout: "Quá hạn thanh toán đơn đấu giá",
  DisputeCompensation: "Bồi hoàn sau khiếu nại",
  ManualAdjustment: "Điều chỉnh bởi quản trị viên",
  ViolationPenalty: "Bị xử phạt vi phạm",
  SellerCancellation: "Người bán hủy đơn",
  ReportPenalty: "Bị trừ điểm sau báo cáo",
  BuyerRefusedDelivery: "Từ chối nhận hàng",
});
