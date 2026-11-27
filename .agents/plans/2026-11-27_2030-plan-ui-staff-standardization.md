# Kế hoạch Chuẩn hóa Giao diện Role Staff & Sidebar Gom nhóm Dropdown + Icons

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2030-plan-ui-staff-standardization.md`
> **Tham chiếu Design System:** `DESIGN.md` (chuẩn theo `/admin/withdrawals`)
> **Trạng thái:** Chờ duyệt triển khai (Plan-First)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
1. **Nâng cấp Sidebar của Staff (`staffNavigation`)** sang dạng **gom nhóm có dropdown đóng/mở** (`NavigationSection[]`) giống hệt cơ chế của Admin (`adminNavigationSections`), kèm **icon chuẩn xác** cho từng nhóm và từng mục điều hướng.
2. **Chuẩn hóa toàn bộ giao diện các trang Staff (`/staff/*`)** đồng nhất 1 form với `/admin/withdrawals` (`StaffWithdrawalsScreen`): Card kính mờ bo góc `20px`, bảng dữ liệu bo tròn khớp góc Card (không lòi góc vuông của `thead` hay viền đáy), bộ lọc `FluidChoiceBar` / `.ops-filters` thống nhất, Modal/Dialog chuẩn kính mờ.

## 2. Context & Bằng chứng hiện trạng (Code Audit)
- **Tệp tham chiếu đã đọc:** `src/constants/navigation.ts`, `src/components/client/ClientShells.tsx`, `src/components/layout/NavLinks.tsx`, `src/components/layout/Shells.tsx`, `src/components/ui/Icon.tsx`, `src/components/layout/Breadcrumbs.tsx`, `src/features/staff/StaffWithdrawalsScreen.tsx`, `src/features/staff/StaffSellersScreen.tsx`, `src/features/staff/StaffProductModerationScreen.tsx`, `src/features/staff/StaffProductReportsScreen.tsx`, `src/features/staff/StaffProductReviewsScreen.tsx`, `src/features/staff/StaffReportsScreen.tsx`, `src/features/admin/AdminPenaltiesScreen.tsx`, `src/features/refunds/RefundsScreen.tsx`, `src/features/auction/AuctionOperations.tsx`, `src/features/auction/AuctionOpsScreen.tsx`, `src/features/admin/notifications/NotificationCenterScreen.tsx`.
- **Các điểm lệch chuẩn phát hiện được:**
  1. **Sidebar Staff dạng danh sách phẳng & trùng icon (`navigation.ts:41-53`, `ClientShells.tsx:21-24`):**
     - `StaffShellClient` đang truyền `items={useEnabledNavigation(staffNavigation)}` (mảng phẳng 11 mục) thay vì `sections={useEnabledNavigationSections(staffNavigationSections)}` như `AdminShellClient`.
     - Icon bị trùng lặp nhiều: `"gavel"` dùng 3 lần (Giám sát đấu giá, Vận hành đấu giá, Xử phạt vi phạm), `"flag"` dùng 3 lần (Khiếu nại, Báo cáo sản phẩm, Kiểm duyệt đánh giá), `"orders"` dùng 2 lần (Hoàn tiền, Trung tâm thông báo), `"grid"` (Duyệt sản phẩm), `"wallet"` (Duyệt rút tiền).
  2. **Mobile Drawer khi dùng `sections` (`globals.css:1098`):**
     - `.mobile-menu .side-nav` hiện đặt `grid-template-columns: repeat(2, minmax(0, 1fr))`. Khi `NavLinks` render `.side-nav-group` (dropdown theo nhóm như Admin), bố cục grid 2 cột trên mobile `<780px` có thể làm các group mở rộng bị xô lệch; cần chỉnh `.mobile-menu .side-nav:has(.side-nav-group)` thành 1 cột dọc gọn gàng.
  3. **Card & Data Table lệch form giữa các trang Staff:**
     - `/staff/withdrawals` (`StaffWithdrawalsScreen`) dùng `FluidChoiceBar` + `<Card><div className="table-scroll">` nhưng bị lòi góc vuông của `thead` vì `.card` thiếu `overflow: hidden` và `.table-scroll` chưa kế thừa bo góc.
     - `/staff/sellers` (`StaffSellersScreen`) dùng `FluidChoiceBar` + `<Card><div className="table-scroll">` và có `<PageHeading overline="Nghiệp vụ Vận hành" ...>` (overline bị ẩn bởi CSS `.portal-main .page-heading .overline`).
     - `/staff/product-moderation` (`StaffProductModerationScreen`) dùng Card filter `.ops-filters` + `<select>` thay vì `FluidChoiceBar` cho trạng thái, và dùng inline `padding: "12px 10px"` trên `<th>`.
     - `/staff/reports` (`StaffReportsScreen`) dùng `<div className="toolbar">` nhét bên trong cùng `<Card>` với bảng (khác form tách Card filter hoặc `FluidChoiceBar` của `withdrawals`/`sellers`), và trong modal có nhiều màu cứng `#f0fdf4`, `#16a34a`, `#dc2626`.
     - `/staff/product-reviews` (`StaffProductReviewsScreen`) và `/staff/product-reports` (`StaffProductReportsScreen`) có style filter/card hơi khác nhau (`marginBottom: 16`, `display: "grid", gap: "12px"` inline).
     - `/staff/notification-center` (`NotificationCenterScreen`) và `/staff/auction-ops` (`AuctionOpsScreen`) bọc bảng trong `<Card className="card-pad">` làm bảng bị thụt lề thay vì flush full-width trong `<Card>` như `/admin/withdrawals`.
  4. **Breadcrumbs thiếu route (`Breadcrumbs.tsx`):** Thiếu `/staff/product-reports`, `/staff/notification-center`, `/staff/refunds`.

## 3. Phân tích phạm vi ảnh hưởng (Impact Analysis)
- Theo GitNexus `impact NavLinks` & `impact staffNavigation`: `StaffShellClient` là consumer duy nhất của `staffNavigation` trong runtime layout; `NavLinks` đã hỗ trợ sẵn prop `sections?: NavigationSection[]` và `useEnabledNavigationSections` đã xử lý sẵn lọc feature flags cho từng group.
- Cần giữ export `staffNavigation` (tính từ `staffNavigationSections.flatMap(...)` giống `adminNavigation`) để không làm gãy bất kỳ file test hay import nào đang tham chiếu `staffNavigation`.

## 4. Thiết kế Gom nhóm Sidebar & Icon cho Staff (`staffNavigationSections`)

| Nhóm / Mục | Route | Icon chuẩn (`IconName`) | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Group: Đấu giá & Giám sát** (`id: "staff-auctions"`, icon: `"gavel"`) | | | |
| ↳ Giám sát đấu giá | `/staff/auctions` | `"gavel"` | Đúng biểu tượng búa đấu giá |
| ↳ Vận hành đấu giá | `/staff/auction-ops` | `"activity"` | Đồng bộ với Admin |
| **Group: Gian hàng & Sản phẩm** (`id: "staff-sellers-catalog"`, icon: `"package"`) | | | |
| ↳ Duyệt người bán | `/staff/sellers` | `"store"` | Hồ sơ gian hàng |
| ↳ Duyệt sản phẩm | `/staff/product-moderation` | `"packageCheck"` | Kiểm duyệt sản phẩm |
| **Group: Kiểm duyệt & Xử phạt** (`id: "staff-moderation"`, icon: `"shieldAlert"`) | | | |
| ↳ Khiếu nại & Vi phạm | `/staff/reports` | `"flag"` | Báo cáo vi phạm |
| ↳ Báo cáo sản phẩm | `/staff/product-reports` | `"alertOctagon"` | Báo cáo sản phẩm |
| ↳ Kiểm duyệt đánh giá | `/staff/product-reviews` | `"star"` | Đánh giá sản phẩm |
| ↳ Xử phạt vi phạm | `/staff/penalties` | `"alertTriangle"` | Biên bản xử phạt |
| **Group: Tài chính & Hoàn tiền** (`id: "staff-finance"`, icon: `"wallet"`) | | | |
| ↳ Duyệt rút tiền | `/staff/withdrawals` | `"arrowUp"` | Yêu cầu rút tiền |
| ↳ Hoàn tiền | `/staff/refunds` (`feature: "refunds"`) | `"rotateCcw"` | Hoàn tiền đơn hàng |
| **Group: Thông báo hệ thống** (`id: "staff-notifications"`, icon: `"bell"`) | | | |
| ↳ Trung tâm thông báo | `/staff/notification-center` | `"mail"` | Đồng bộ với Admin |

## 5. Checklist Triển khai (Step-by-Step)

### Pha 1: Nâng cấp Sidebar Gom nhóm Dropdown & Icon cho Staff
- [ ] **Task 1.1:** Kiểm tra và bổ sung (nếu thiếu) các icon cần thiết trong `src/components/ui/Icon.tsx`. Hiện toàn bộ icon ở bảng mục 4 (`gavel`, `activity`, `package`, `store`, `packageCheck`, `shieldAlert`, `flag`, `alertOctagon`, `star`, `alertTriangle`, `wallet`, `arrowUp`, `rotateCcw`, `bell`, `mail`) đều đã tồn tại trong `Icon.tsx`.
- [ ] **Task 1.2:** Refactor `src/constants/navigation.ts`: định nghĩa `staffNavigationSections: NavigationSection[]` theo đúng 5 nhóm dropdown ở mục 4, và giữ `export const staffNavigation = staffNavigationSections.flatMap(...)` để tương thích ngược.
- [ ] **Task 1.3:** Cập nhật `StaffShellClient` trong `src/components/client/ClientShells.tsx` dùng `useEnabledNavigationSections(staffNavigationSections)` và truyền `sections={sections}` vào `<PortalShell>`.
- [ ] **Task 1.4:** Kiểm tra `NavLinks.tsx` khi render grouped sections trên desktop (`portal-sidebar`) và mobile (`mobile-menu`); cập nhật CSS trong `globals.css` để `.mobile-menu .side-nav` không bị chia 2 cột khi chứa `.side-nav-group`.
- [ ] **Task 1.5:** Bổ sung labels `/staff/product-reports`, `/staff/notification-center`, `/staff/refunds` vào `src/components/layout/Breadcrumbs.tsx`.
- 🔄 **Phase 1 Gate:** Verify mọi route `/staff/*` đều tự động mở đúng group dropdown tương ứng khi truy cập trực tiếp (kể cả route con `/staff/sellers/[id]`, `/staff/auctions/[id]`, `/staff/auctions/[id]/deposits`).

### Pha 2: Chuẩn hóa Giao diện Toàn bộ Trang Staff theo Form `/admin/withdrawals`
- [ ] **Task 2.1:** Chuẩn hóa cấu trúc trang chuẩn Staff: `PageHeading` -> `FluidChoiceBar` (nếu lọc trạng thái) / Filter `<Card className="card-pad">` (nếu lọc nhiều trường) -> `<Card>` (không padding, `overflow: hidden`) bọc `<div className="table-scroll"><table className="data-table">` + `<AdminPagination>` footer.
- [ ] **Task 2.2:** Rà soát và đồng nhất từng màn hình Staff:
  - `StaffWithdrawalsScreen.tsx` (`/staff/withdrawals`)
  - `StaffSellersScreen.tsx` (`/staff/sellers`, `/staff/sellers/[id]`)
  - `StaffProductModerationScreen.tsx` (`/staff/product-moderation`): đồng bộ `FluidChoiceBar` hoặc filter form, bỏ inline `padding` trên `<th>` để dùng padding chuẩn `.data-table th`.
  - `StaffProductReportsScreen.tsx` (`/staff/product-reports`)
  - `StaffProductReviewsScreen.tsx` (`/staff/product-reviews`)
  - `StaffReportsScreen.tsx` (`/staff/reports`): tách filter ra khỏi Card bảng (đồng bộ form filter chuẩn) và thay màu hex cứng trong modal bằng token CSS.
  - `AdminPenaltiesScreen.tsx` (`/staff/penalties`)
  - `RefundsScreen.tsx` (`/staff/refunds`)
  - `AuctionOperations.tsx` & `AuctionOpsScreen.tsx` (`/staff/auctions`, `/staff/auctions/[id]`, `/staff/auctions/[id]/deposits`, `/staff/auction-ops`): bỏ `card-pad` bọc bảng hoặc thêm `table-scroll` bo góc chuẩn, bỏ `borderRadius: "10px"` inline.
  - `NotificationCenterScreen.tsx` (`/staff/notification-center`): chuẩn hóa `<Card><div className="table-scroll">` và `TableSkeleton` thay cho `<p>Đang tải…</p>`.
- 🔄 **Phase 2 Gate:** Chạy `npm run typecheck`, `npm run lint`, `npm run build` hoàn tất 0 lỗi.

## 6. Kiểm chứng (Verification)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
```
