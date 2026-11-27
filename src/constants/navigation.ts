import { ROUTES } from "./routes";
import type { IconName } from "@/components/ui/Icon";
import type { FeatureKey } from "@/lib/features/feature-flags";

/** `feature`: the entry is shown only while that flag is on, so a menu never points at a screen that is not switched on. */
export type NavigationItem = { label: string; href: string; icon: IconName; feature?: FeatureKey };

export const buyerNavigation: NavigationItem[] = [
  { label: "Trang chủ", href: ROUTES.home, icon: "home" },
  { label: "Sản phẩm", href: ROUTES.catalog.index, icon: "grid" },
  { label: "Đấu giá trực tiếp", href: ROUTES.auction.index, icon: "gavel" },
  { label: "Đấu giá của tôi", href: ROUTES.buyer.auctions, icon: "gavel" },
  { label: "Đơn đấu giá", href: ROUTES.buyer.auctionOrders, icon: "orders" },
  { label: "Cọc của tôi", href: ROUTES.buyer.deposits, icon: "wallet" },
  { label: "Hoàn tiền", href: ROUTES.buyer.refunds, icon: "orders", feature: "refunds" },
  { label: "Theo dõi phiên", href: ROUTES.buyer.watchlist, icon: "gavel" },
  { label: "Uy tín của tôi", href: ROUTES.buyer.reputation, icon: "users" },
  { label: "Đăng ký bán hàng", href: ROUTES.buyer.becomeSeller, icon: "warehouse" },
];

export const sellerNavigation: NavigationItem[] = [
  { label: "Quản lý sản phẩm", href: ROUTES.seller.products, icon: "grid" },
  { label: "Hồ sơ gian hàng", href: ROUTES.seller.shop, icon: "users" },
  { label: "Quản lý kho", href: ROUTES.seller.inventory, icon: "warehouse" },
  { label: "Đơn bán", href: ROUTES.seller.orders, icon: "orders" },
  { label: "Vận chuyển", href: ROUTES.seller.shipments, icon: "warehouse" },
  { label: "Hoàn tiền", href: ROUTES.seller.refunds, icon: "orders", feature: "refunds" },
  { label: "Phiên đấu giá", href: ROUTES.seller.auctions, icon: "gavel" },
  { label: "Đơn đấu giá", href: ROUTES.seller.auctionOrders, icon: "gavel" },
  { label: "Doanh thu & ví", href: ROUTES.seller.wallet, icon: "wallet" },
  { label: "Mã giảm giá", href: ROUTES.seller.coupons, icon: "orders", feature: "vouchers" },
  { label: "Đánh giá & uy tín", href: ROUTES.seller.reviews, icon: "users" },
];

export const staffNavigation: NavigationItem[] = [
  { label: "Giám sát đấu giá", href: ROUTES.staff.auctions, icon: "gavel" },
  { label: "Vận hành đấu giá", href: ROUTES.staff.auctionOps, icon: "gavel" },
  { label: "Duyệt người bán", href: ROUTES.staff.sellers, icon: "users" },
  { label: "Duyệt sản phẩm", href: ROUTES.staff.productModeration, icon: "grid" },
  { label: "Duyệt rút tiền", href: ROUTES.staff.withdrawals, icon: "wallet" },
  { label: "Khiếu nại & Vi phạm", href: ROUTES.staff.reports, icon: "flag" },
  { label: "Báo cáo sản phẩm", href: ROUTES.staff.productReports, icon: "flag" },
  { label: "Kiểm duyệt đánh giá", href: ROUTES.staff.productReviews, icon: "flag" },
  { label: "Hoàn tiền", href: ROUTES.staff.refunds, icon: "orders", feature: "refunds" },
  { label: "Trung tâm thông báo", href: ROUTES.staff.notificationCenter, icon: "orders" },
  { label: "Xử phạt vi phạm", href: ROUTES.staff.penalties, icon: "gavel" },
];

export const adminNavigation: NavigationItem[] = [
  { label: "Tổng quan hệ thống", href: ROUTES.admin.overview, icon: "home" },
  { label: "Tài khoản & Phân quyền", href: ROUTES.admin.users, icon: "users" },
  { label: "Duyệt người bán", href: ROUTES.admin.sellers, icon: "users" },
  { label: "Danh mục sản phẩm", href: ROUTES.admin.categories, icon: "grid" },
  { label: "Duyệt sản phẩm", href: ROUTES.admin.productModeration, icon: "grid" },
  { label: "Khiếu nại & Vi phạm", href: ROUTES.admin.reports, icon: "flag" },
  { label: "Báo cáo sản phẩm", href: ROUTES.admin.productReports, icon: "flag" },
  { label: "Kiểm duyệt đánh giá", href: ROUTES.admin.productReviews, icon: "flag" },
  { label: "Xử phạt vi phạm", href: ROUTES.admin.penalties, icon: "gavel" },
  { label: "Điều chỉnh số dư ví", href: ROUTES.admin.ledger, icon: "wallet" },
  { label: "Duyệt rút tiền", href: ROUTES.admin.withdrawals, icon: "wallet" },
  { label: "Sổ giao dịch", href: ROUTES.admin.ledgerTransactions, icon: "wallet", feature: "ledger" },
  { label: "Đối soát số dư ví", href: ROUTES.admin.ledgerBalances, icon: "wallet", feature: "ledger" },
  { label: "Đối soát tiền", href: ROUTES.admin.reconciliation, icon: "wallet", feature: "reconciliation" },
  { label: "Sổ bóng", href: ROUTES.admin.ledgerJournal, icon: "wallet", feature: "ledger" },
  { label: "Mã giảm giá", href: ROUTES.admin.coupons, icon: "orders", feature: "vouchers" },
  { label: "Hoàn tiền", href: ROUTES.admin.refunds, icon: "orders", feature: "refunds" },
  { label: "Công cụ ví", href: ROUTES.admin.walletTools, icon: "wallet" },
  { label: "Phí nền tảng", href: ROUTES.admin.platformFee, icon: "wallet" },
  { label: "Ngân sách trợ giá", href: ROUTES.admin.subsidyBudgets, icon: "wallet" },
  { label: "Vận hành đấu giá", href: ROUTES.admin.auctionOps, icon: "gavel" },
  { label: "Cài đặt đấu giá", href: ROUTES.admin.auctionConfigs, icon: "gavel" },
  { label: "Quyết toán đấu giá", href: ROUTES.admin.auctionSettlements, icon: "orders" },
  { label: "Vận đơn & Giả lập GHN", href: ROUTES.admin.shipments, icon: "orders" },
  { label: "Cài đặt hệ thống", href: ROUTES.admin.configs, icon: "shield" },
  { label: "Nhật ký kiểm toán", href: ROUTES.admin.auditLogs, icon: "orders", feature: "audit" },
  { label: "Cảnh báo bảo mật", href: ROUTES.admin.securityAlerts, icon: "shield", feature: "security-alerts" },
  { label: "Sức khỏe hệ thống", href: ROUTES.admin.systemHealth, icon: "shield", feature: "system-health" },
  { label: "Nhật ký & Thông báo", href: ROUTES.admin.notifications, icon: "orders" },
  { label: "Trung tâm thông báo", href: ROUTES.admin.notificationCenter, icon: "orders" },
];
