import { ROUTES } from "./routes";
import type { IconName } from "@/components/ui/Icon";
import type { FeatureKey } from "@/lib/features/feature-flags";

/** `feature`: the entry is shown only while that flag is on, so a menu never points at a screen that is not switched on. */
export type NavigationItem = { label: string; href: string; icon: IconName; feature?: FeatureKey };

export type NavigationGroup = {
  id: string;
  label: string;
  icon: IconName;
  items: NavigationItem[];
};

export type NavigationSection =
  | { kind: "item"; item: NavigationItem }
  | { kind: "group"; group: NavigationGroup };

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
  { label: "Quản lý sản phẩm", href: ROUTES.seller.products, icon: "package" },
  { label: "Hồ sơ gian hàng", href: ROUTES.seller.shop, icon: "store" },
  { label: "Quản lý kho", href: ROUTES.seller.inventory, icon: "warehouse" },
  { label: "Đơn bán", href: ROUTES.seller.orders, icon: "orders" },
  { label: "Vận chuyển", href: ROUTES.seller.shipments, icon: "truck" },
  { label: "Hoàn tiền", href: ROUTES.seller.refunds, icon: "rotateCcw", feature: "refunds" },
  { label: "Phiên đấu giá", href: ROUTES.seller.auctions, icon: "gavel" },
  { label: "Đơn đấu giá", href: ROUTES.seller.auctionOrders, icon: "checkSquare" },
  { label: "Doanh thu & ví", href: ROUTES.seller.wallet, icon: "wallet" },
  { label: "Mã giảm giá", href: ROUTES.seller.coupons, icon: "ticket", feature: "vouchers" },
  { label: "Đánh giá & uy tín", href: ROUTES.seller.reviews, icon: "star" },
];

export const staffNavigationSections: NavigationSection[] = [
  {
    kind: "group",
    group: {
      id: "staff-auctions",
      label: "Đấu giá & Giám sát",
      icon: "gavel",
      items: [
        { label: "Giám sát đấu giá", href: ROUTES.staff.auctions, icon: "gavel" },
        { label: "Vận hành đấu giá", href: ROUTES.staff.auctionOps, icon: "activity" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "staff-sellers-catalog",
      label: "Gian hàng & Sản phẩm",
      icon: "package",
      items: [
        { label: "Duyệt người bán", href: ROUTES.staff.sellers, icon: "store" },
        { label: "Duyệt sản phẩm", href: ROUTES.staff.productModeration, icon: "packageCheck" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "staff-moderation",
      label: "Kiểm duyệt & Xử phạt",
      icon: "shieldAlert",
      items: [
        { label: "Khiếu nại & Vi phạm", href: ROUTES.staff.reports, icon: "flag" },
        { label: "Báo cáo sản phẩm", href: ROUTES.staff.productReports, icon: "alertOctagon" },
        { label: "Kiểm duyệt đánh giá", href: ROUTES.staff.productReviews, icon: "star" },
        { label: "Xử phạt vi phạm", href: ROUTES.staff.penalties, icon: "alertTriangle" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "staff-finance",
      label: "Tài chính & Hoàn tiền",
      icon: "wallet",
      items: [
        { label: "Duyệt rút tiền", href: ROUTES.staff.withdrawals, icon: "arrowUp" },
        { label: "Hoàn tiền", href: ROUTES.staff.refunds, icon: "rotateCcw", feature: "refunds" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "staff-notifications",
      label: "Thông báo hệ thống",
      icon: "bell",
      items: [
        { label: "Trung tâm thông báo", href: ROUTES.staff.notificationCenter, icon: "mail" },
      ],
    },
  },
];

export const staffNavigation: NavigationItem[] = staffNavigationSections.flatMap((section) =>
  section.kind === "item" ? [section.item] : section.group.items,
);

export const adminNavigationSections: NavigationSection[] = [
  {
    kind: "item",
    item: { label: "Tổng quan hệ thống", href: ROUTES.admin.overview, icon: "home" },
  },
  {
    kind: "group",
    group: {
      id: "users-sellers",
      label: "Người dùng & Gian hàng",
      icon: "users",
      items: [
        { label: "Tài khoản & Phân quyền", href: ROUTES.admin.users, icon: "userCog" },
        { label: "Duyệt người bán", href: ROUTES.admin.sellers, icon: "store" },
        { label: "Xử phạt vi phạm", href: ROUTES.admin.penalties, icon: "alertTriangle" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "catalog-moderation",
      label: "Sản phẩm & Kiểm duyệt",
      icon: "package",
      items: [
        { label: "Danh mục sản phẩm", href: ROUTES.admin.categories, icon: "layers" },
        { label: "Duyệt sản phẩm", href: ROUTES.admin.productModeration, icon: "packageCheck" },
        { label: "Khiếu nại & Vi phạm", href: ROUTES.admin.reports, icon: "flag" },
        { label: "Báo cáo sản phẩm", href: ROUTES.admin.productReports, icon: "alertOctagon" },
        { label: "Kiểm duyệt đánh giá", href: ROUTES.admin.productReviews, icon: "star" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "finance-wallet",
      label: "Tài chính & Ví",
      icon: "wallet",
      items: [
        { label: "Điều chỉnh số dư ví", href: ROUTES.admin.ledger, icon: "sliders" },
        { label: "Duyệt rút tiền", href: ROUTES.admin.withdrawals, icon: "arrowUp" },
        { label: "Sổ giao dịch", href: ROUTES.admin.ledgerTransactions, icon: "receipt", feature: "ledger" },
        { label: "Đối soát số dư ví", href: ROUTES.admin.ledgerBalances, icon: "scale", feature: "ledger" },
        { label: "Đối soát tiền", href: ROUTES.admin.reconciliation, icon: "refreshCw", feature: "reconciliation" },
        { label: "Sổ bóng", href: ROUTES.admin.ledgerJournal, icon: "bookOpen", feature: "ledger" },
        { label: "Công cụ ví", href: ROUTES.admin.walletTools, icon: "wrench" },
        { label: "Phí nền tảng", href: ROUTES.admin.platformFee, icon: "percent" },
        { label: "Ngân sách trợ giá", href: ROUTES.admin.subsidyBudgets, icon: "coins" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "auctions-promotions",
      label: "Đấu giá & Khuyến mãi",
      icon: "gavel",
      items: [
        { label: "Vận hành đấu giá", href: ROUTES.admin.auctionOps, icon: "activity" },
        { label: "Cài đặt đấu giá", href: ROUTES.admin.auctionConfigs, icon: "slidersHorizontal" },
        { label: "Quyết toán đấu giá", href: ROUTES.admin.auctionSettlements, icon: "checkSquare" },
        { label: "Mã giảm giá", href: ROUTES.admin.coupons, icon: "ticket", feature: "vouchers" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "orders-fulfillment",
      label: "Đơn hàng & Vận chuyển",
      icon: "bag",
      items: [
        { label: "Hoàn tiền", href: ROUTES.admin.refunds, icon: "rotateCcw", feature: "refunds" },
        { label: "Vận đơn & Giả lập GHN", href: ROUTES.admin.shipments, icon: "truck" },
      ],
    },
  },
  {
    kind: "group",
    group: {
      id: "system-notifications",
      label: "Hệ thống & Thông báo",
      icon: "shield",
      items: [
        { label: "Cài đặt hệ thống", href: ROUTES.admin.configs, icon: "settings" },
        { label: "Nhật ký & Thông báo", href: ROUTES.admin.notifications, icon: "bell" },
        { label: "Trung tâm thông báo", href: ROUTES.admin.notificationCenter, icon: "mail" },
        { label: "Nhật ký kiểm toán", href: ROUTES.admin.auditLogs, icon: "fileClock", feature: "audit" },
        { label: "Cảnh báo bảo mật", href: ROUTES.admin.securityAlerts, icon: "shieldAlert", feature: "security-alerts" },
        { label: "Sức khỏe hệ thống", href: ROUTES.admin.systemHealth, icon: "heartPulse", feature: "system-health" },
      ],
    },
  },
];

export const adminNavigation: NavigationItem[] = adminNavigationSections.flatMap((section) =>
  section.kind === "item" ? [section.item] : section.group.items,
);
