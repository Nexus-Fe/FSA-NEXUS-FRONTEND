# Kế hoạch Chuẩn hóa Giao diện Role Admin (Quản trị Hệ thống)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2030-plan-ui-admin-standardization.md`
> **Tham chiếu Design System:** `DESIGN.md` (chuẩn theo `/admin/withdrawals`)
> **Trạng thái:** Chờ duyệt triển khai (Plan-First)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
Chuẩn hóa 100% các trang quản trị dưới `/admin/*` theo đúng form chuẩn của `/admin/withdrawals` và `DESIGN.md`: xử lý triệt để lỗi bo góc bảng dữ liệu không khớp nền Card, gom lại các màn hình thiếu `<Card>` hoặc nhét bảng sai cấu trúc (`SubsidyBudgetsScreen`, `OperationsScreens`, `LedgerScreens`), chuẩn hóa thông báo loading/lỗi và hoàn thiện Breadcrumbs.

## 2. Context & Bằng chứng hiện trạng (Code Audit)
- **Tệp tham chiếu đã đọc:** `src/constants/navigation.ts`, `src/components/layout/Breadcrumbs.tsx`, `src/features/staff/StaffWithdrawalsScreen.tsx`, `src/features/admin/AdminScreens.tsx`, `src/features/admin/AdminUsersScreen.tsx`, `src/features/admin/AdminCategoriesScreen.tsx`, `src/features/admin/AdminConfigsScreen.tsx`, `src/features/admin/AdminAuctionConfigsScreen.tsx`, `src/features/admin/AdminPenaltiesScreen.tsx`, `src/features/admin/AdminNotificationsScreen.tsx`, `src/features/admin/AdminLedgerScreen.tsx`, `src/features/admin/AdminShipmentsScreen.tsx`, `src/features/admin/AdminRolesScreen.tsx`, `src/features/admin/finance/SubsidyBudgetsScreen.tsx`, `src/features/admin/finance/PlatformFeeScreen.tsx`, `src/features/admin/finance/WalletToolsScreen.tsx`, `src/features/admin/ledger/LedgerScreens.tsx`, `src/features/admin/operations/OperationsScreens.tsx`, `src/features/auction/AdminAuctionSettlements.tsx`, `src/features/auction/AdminAuctionDeposits.tsx`, `src/features/auction/AdminDepositPolicy.tsx`.
- **Các điểm lệch chuẩn phát hiện được:**
  1. **Bảng & Card không bo góc đồng bộ (gồm cả `/admin/withdrawals`):**
     - `.portal-shell-operations .portal-main .card` có `border-radius: 20px` nhưng thiếu `overflow: hidden`. Bên trong `<Card>`, `.table-scroll` không có `border-radius: inherit`, `.data-table th` tô nền `rgba(247, 241, 232, .78)` thành 4 góc nhọn đè lên góc bo `20px` của Card, và `tr:last-child td` còn `border-bottom`.
  2. **Thiếu `<Card>` bọc bảng ở `/admin/subsidy-budgets` (`SubsidyBudgetsScreen.tsx:66`):**
     - `DataState` render thẳng `<div className="table-scroll"><table className="data-table">` nằm trần trên nền trang, không có `<Card>` bọc ngoài!
  3. **Bọc `<Card className="card-pad">` quanh bảng ở nhóm Ledger & Operations (`LedgerScreens.tsx`, `OperationsScreens.tsx`, `WalletToolsScreen.tsx`, `AdminShipmentsScreen.tsx`, `AdminRolesScreen.tsx`, `AdminAuctionConfigsScreen.tsx`, `AdminAuctionDeposits.tsx`, `NotificationCenterScreen.tsx`):**
     - Các màn này gộp bộ lọc + bảng chung vào `<Card className="card-pad">` khiến bảng có khoảng đệm vuông lọt thỏm, không đồng nhất với form flush `<Card><div className="table-scroll">` + `AdminPagination` như `/admin/withdrawals` và `/admin/users`.
  4. **Trạng thái Loading thô (`<p>Đang tải…</p>`):**
     - `OperationsScreens.tsx`, `LedgerScreens.tsx`, `NotificationCenterScreen.tsx` dùng `<p>Đang tải…</p>` thay vì `TableSkeleton` / `LoadingState` như các trang khác.
  5. **Mã màu cũ & Inline styles:**
     - `AdminUsersScreen.tsx` chứa nhiều màu hex inline (`#16a34a`, `#d97706`, `#dc2626`, `#f8fafc`, `#f0fdf4`, `#fef2f2`) có thể rút gọn qua CSS utility/semantic classes.
     - `AdminNotificationsScreen.tsx:457, 529, 537` dùng khối `<pre style={{ background: "#1e293b" }}>` — nên dùng CSS class chuẩn và token `--hero-bg-deep`.
     - `AdminAuctionSettlements.tsx` dùng `<Card className="auction-table-card">` (thêm padding `16px` khác form chuẩn).
  6. **Breadcrumbs thiếu route (`Breadcrumbs.tsx`):** Thiếu `/admin/sellers`, `/admin/product-moderation`, `/admin/product-reports`, `/admin/notification-center`, `/admin/refunds`, `/admin/shipments`, `/admin/audit-logs`, `/admin/security-alerts`, `/admin/system-health`, `/admin/ledger/transactions`, `/admin/ledger/balances`, `/admin/ledger/journal`, `/admin/reconciliation`, `/admin/auction-settlements`.

## 3. Phân tích phạm vi ảnh hưởng (Impact Analysis)
- Toàn bộ các màn hình dùng chung với Staff (`/admin/withdrawals`, `/admin/sellers`, `/admin/product-moderation`, `/admin/product-reports`, `/admin/product-reviews`, `/admin/reports`, `/admin/penalties`, `/admin/refunds`, `/admin/auctions`, `/admin/auction-ops`, `/admin/notification-center`) sẽ tự động hưởng lợi khi chuẩn hóa chung trong Plan Staff + Plan Admin.
- Tách riêng phạm vi Admin tập trung vào các màn hình riêng của Admin: `AdminOverview`, `AdminUsers`, `AdminRoles`, `AdminCategories`, `AdminConfigs`, `AdminCoupons`, `AdminAuctionConfigs`, `AdminDepositPolicy`, `AdminAuctionSettlements`, `AdminLedger`, `LedgerScreens`, `Reconciliation`, `WalletTools`, `PlatformFee`, `SubsidyBudgets`, `AdminShipments`, `AdminNotifications`, `OperationsScreens` (`audit-logs`, `security-alerts`, `system-health`).

## 4. Checklist Triển khai (Step-by-Step)

### Pha 1: Sửa Tận gốc Card/Table Clipping & Breadcrumbs Admin
- [ ] **Task 1.1:** Đảm bảo `.portal-shell-operations .portal-main .card` có `overflow: hidden` và quy tắc chung cho `.card > .table-scroll` (bo góc trên/dưới khớp `20px`, bỏ `border-bottom` của hàng cuối khi không có pagination bar bên dưới; nếu có `AdminPagination` thì `AdminPagination` giữ vai trò footer bo góc dưới).
- [ ] **Task 1.2:** Bổ sung đầy đủ toàn bộ labels `/admin/*` còn thiếu vào `src/components/layout/Breadcrumbs.tsx`.
- [ ] **Task 1.3:** Rà soát `adminNavigationSections` trong `src/constants/navigation.ts` và CSS mobile drawer (`.mobile-menu .side-nav`).
- 🔄 **Phase 1 Gate:** Kiểm tra `/admin/withdrawals` đạt chuẩn bo góc 4 phía sạch sẽ, không lòi góc vuông của `thead`.

### Pha 2: Chuẩn hóa Toàn bộ Màn hình Riêng của Admin
- [ ] **Task 2.1:** Sửa `SubsidyBudgetsScreen.tsx`: bọc bảng dữ liệu trong `<Card>` + `<AdminPagination>` đúng chuẩn `/admin/withdrawals`.
- [ ] **Task 2.2:** Chuẩn hóa `LedgerScreens.tsx` (`transactions`, `balances`, `reconciliation`, `journal`) và `OperationsScreens.tsx` (`audit-logs`, `security-alerts`, `system-health`): tách bộ lọc ra `<Card className="card-pad">` (khi có nhiều field lọc) và đặt bảng trong `<Card>` flush riêng biệt; thay `<p>Đang tải…</p>` bằng `TableSkeleton` / `LoadingState`.
- [ ] **Task 2.3:** Chuẩn hóa `WalletToolsScreen.tsx`, `PlatformFeeScreen.tsx`, `AdminLedgerScreen.tsx`, `AdminShipmentsScreen.tsx`, `AdminCategoriesScreen.tsx`, `AdminConfigsScreen.tsx`, `AdminCouponsScreen.tsx`/`VoucherManager.tsx`, `AdminAuctionConfigsScreen.tsx`, `AdminAuctionSettlements.tsx`, `AdminNotificationsScreen.tsx`, `AdminUsersScreen.tsx`, `AdminOverviewScreen.tsx` về một form Card/Table/Filter/Modal thống nhất theo `DESIGN.md`.
- 🔄 **Phase 2 Gate:** Chạy `npm run typecheck`, `npm run lint`, `npm run build` đạt 0 lỗi.

## 5. Kiểm chứng (Verification)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
```
