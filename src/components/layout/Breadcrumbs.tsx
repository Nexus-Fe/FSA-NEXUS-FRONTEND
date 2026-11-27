"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { TruncatedText } from "@/components/ui/TruncatedText";

const labels: Record<string, string> = {
  "/catalog": "Sản phẩm", "/shops": "Gian hàng", "/auctions": "Đấu giá trực tiếp",
  "/buyer/cart": "Giỏ hàng", "/buyer/checkout": "Thông tin giao hàng",
  "/buyer/orders": "Đơn mua", "/buyer/refunds": "Hoàn tiền", "/buyer/wallet/top-ups": "Lịch sử nạp tiền", "/buyer/notifications": "Thông báo", "/buyer/auctions": "Đấu giá của tôi", "/buyer/auction-orders": "Đơn hàng đấu giá", "/buyer/deposits": "Cọc của tôi", "/buyer/watchlist": "Theo dõi phiên", "/buyer/wallet": "Ví của tôi",
  "/buyer/wallet/top-up": "Nạp tiền", "/buyer/wallet/transfer": "Chuyển tiền", "/buyer/reputation": "Uy tín của tôi", "/buyer/reports": "Báo cáo", "/buyer/become-seller": "Đăng ký bán hàng",
  "/buyer/payment": "Thanh toán", "/buyer/payment/result": "Kết quả thanh toán",
  "/seller": "Kênh người bán", "/seller/products": "Quản lý sản phẩm", "/seller/products/new": "Tạo sản phẩm", "/seller/products/auction/new": "Tạo sản phẩm đấu giá",
  "/seller/shop": "Hồ sơ gian hàng", "/seller/notifications": "Thông báo", "/seller/inventory": "Quản lý kho", "/seller/orders": "Đơn bán",
  "/seller/shipments": "Vận chuyển", "/seller/refunds": "Hoàn tiền", "/seller/auctions": "Phiên đấu giá", "/seller/auctions/new": "Tạo phiên đấu giá", "/seller/auction-orders": "Đơn đấu giá",
  "/seller/wallet": "Doanh thu & ví", "/seller/withdrawals": "Yêu cầu rút tiền", "/seller/reviews": "Đánh giá & uy tín", "/seller/coupons": "Mã giảm giá",
  "/staff": "Vận hành sàn", "/staff/auctions": "Giám sát đấu giá", "/staff/auction-ops": "Vận hành đấu giá", "/staff/sellers": "Duyệt người bán",
  "/staff/product-moderation": "Duyệt sản phẩm", "/staff/product-reports": "Báo cáo sản phẩm", "/staff/product-reviews": "Kiểm duyệt đánh giá", "/staff/withdrawals": "Duyệt rút tiền",
  "/staff/reports": "Khiếu nại & Vi phạm", "/staff/refunds": "Hoàn tiền", "/staff/notification-center": "Trung tâm thông báo", "/staff/penalties": "Xử phạt vi phạm",
  "/staff/transactions/discrepancies": "Đối soát giao dịch",
  "/admin": "Quản trị hệ thống", "/admin/overview": "Tổng quan hệ thống", "/admin/users": "Tài khoản & Phân quyền", "/admin/roles": "Phân quyền & vai trò",
  "/admin/sellers": "Duyệt người bán", "/admin/penalties": "Xử phạt vi phạm", "/admin/categories": "Danh mục sản phẩm", "/admin/product-moderation": "Duyệt sản phẩm",
  "/admin/reports": "Khiếu nại & Vi phạm", "/admin/product-reports": "Báo cáo sản phẩm", "/admin/product-reviews": "Kiểm duyệt đánh giá",
  "/admin/ledger": "Điều chỉnh số dư ví", "/admin/withdrawals": "Duyệt rút tiền", "/admin/ledger/transactions": "Sổ giao dịch", "/admin/ledger/balances": "Đối soát số dư ví", "/admin/reconciliation": "Đối soát tiền", "/admin/ledger/journal": "Sổ bóng",
  "/admin/wallet-tools": "Công cụ ví", "/admin/platform-fee": "Phí nền tảng", "/admin/subsidy-budgets": "Ngân sách trợ giá",
  "/admin/auctions": "Giám sát đấu giá", "/admin/auction-ops": "Vận hành đấu giá", "/admin/auction-configs": "Cài đặt đấu giá", "/admin/auction-configs/deposit-policy": "Chính sách đặt cọc", "/admin/auction-settlements": "Quyết toán đấu giá",
  "/admin/coupons": "Mã giảm giá", "/admin/refunds": "Hoàn tiền", "/admin/shipments": "Vận đơn & Giả lập GHN",
  "/admin/configs": "Cài đặt hệ thống", "/admin/notifications": "Nhật ký & Thông báo", "/admin/notification-center": "Trung tâm thông báo",
  "/admin/audit-logs": "Nhật ký kiểm toán", "/admin/security-alerts": "Cảnh báo bảo mật", "/admin/system-health": "Sức khỏe hệ thống",
  "/account/profile": "Hồ sơ cá nhân", "/account/addresses": "Sổ địa chỉ", "/account/change-password": "Đổi mật khẩu", "/account/sessions": "Phiên đăng nhập", "/account/notification-preferences": "Tuỳ chọn thông báo", "/account/seller-documents": "Giấy tờ đăng ký bán hàng",
};

const terminalLabels: Record<string, string> = {
  edit: "Chỉnh sửa", recreate: "Tạo lại", result: "Kết quả", payment: "Thanh toán", review: "Đánh giá",
};

export function Breadcrumbs({ portal = false }: { portal?: boolean }) {
  const pathname = usePathname();
  if (!pathname || pathname === "/" || pathname.startsWith("/catalog/") || pathname.startsWith("/shops/") || pathname === ROUTES.buyer.cart || pathname === ROUTES.buyer.checkout) return null;

  const pieces = pathname.split("/").filter(Boolean);
  const root = portal ? `/${pieces[0]}` : ROUTES.home;
  const rootLabel = portal ? labels[root] : "Trang chủ";
  if (!rootLabel) return null;

  const crumbs: { href: string; label: string }[] = [{ href: portal ? ({ seller: ROUTES.seller.products, staff: ROUTES.staff.auctions, admin: ROUTES.admin.overview }[pieces[0]] ?? root) : root, label: rootLabel }];
  const start = portal ? 2 : 1;
  for (let index = start; index <= pieces.length; index++) {
    const href = `/${pieces.slice(0, index).join("/")}`;
    const label = labels[href] ?? (index === pieces.length ? terminalLabels[pieces[index - 1]] ?? "Chi tiết" : undefined);
    if (label) crumbs.push({ href, label });
  }
  if (crumbs.length < 2) return null;

  return <nav className="site-breadcrumb" aria-label="Đường dẫn">
    <ol>{crumbs.map((crumb, index) => <li key={`${index}-${crumb.href}`}>
      {index > 0 && <span className="site-breadcrumb-separator" aria-hidden="true">›</span>}
      {index === crumbs.length - 1 ? <span aria-current="page"><TruncatedText text={crumb.label} label="Đường dẫn hiện tại" /></span> : <Link href={crumb.href}>{crumb.label}</Link>}
    </li>)}</ol>
  </nav>;
}
