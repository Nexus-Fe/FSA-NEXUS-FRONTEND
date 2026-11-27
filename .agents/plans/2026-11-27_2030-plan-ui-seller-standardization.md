# Kế hoạch Chuẩn hóa Giao diện Role Seller (Kênh Người Bán)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2030-plan-ui-seller-standardization.md`
> **Tham chiếu Design System:** `DESIGN.md` (chuẩn theo `/admin/withdrawals`)
> **Trạng thái:** Chờ duyệt triển khai (Plan-First)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
Đưa toàn bộ giao diện **Kênh người bán (`/seller/*`)** về chung một chuẩn thiết kế với hệ thống Operations Portal (`/admin/withdrawals`): thẻ card kính mờ bo góc `20px`, bảng dữ liệu bo góc khớp nền card, bộ lọc thống nhất (`FluidChoiceBar` / `.ops-filters`), sidebar có icon đúng ngữ cảnh từng mục, và cập nhật đầy đủ Breadcrumbs.

## 2. Context & Bằng chứng hiện trạng (Code Audit)
- **Tệp tham chiếu đã đọc:** `src/components/layout/Shells.tsx`, `src/components/client/ClientShells.tsx`, `src/constants/navigation.ts`, `src/components/ui/Icon.tsx`, `src/components/layout/Breadcrumbs.tsx`, `src/features/seller/SellerScreens.tsx`, `src/features/seller/SellerProductDetailScreen.tsx`, `src/features/seller/SellerAuctionProductCreate.tsx`, `src/features/auction/AuctionOperations.tsx`, `src/features/auction/SellerAuctionOrders.tsx`, `src/features/wallet/WalletOperationsScreens.tsx`, `src/features/wallet/SellerWithdrawalForm.tsx`, `src/features/coupons/VoucherManager.tsx`, `src/features/reviews/SellerReviewsScreen.tsx`.
- **Các điểm lệch chuẩn phát hiện được:**
  1. **Shell & Card Radius (`Shells.tsx:346`):** `PortalShell` chỉ gắn class `portal-shell-operations` cho `Nhân viên` và `Quản trị viên`. Do đó Seller bị thiếu style `.portal-shell-operations .portal-main .card` (bo góc `20px` và nền kính trắng kem chuẩn như `/admin/withdrawals`), hiện chỉ đang ăn `border-radius: 12px` cũ.
  2. **Bảng dữ liệu lệch form (`SellerScreens.tsx`, `AuctionOperations.tsx`):**
     - `SellerOrders` (`SellerScreens.tsx:2509`) dùng `<Card className="card-pad seller-orders-card"><div className="table-scroll seller-orders-table-scroll">` và bộ lọc `<select>` rời nằm ngoài Card thay vì đồng bộ form filter + table chuẩn.
     - `SellerShipments` (`SellerScreens.tsx:2283`) dùng class `.order-tabs` / `.order-tab` cũ thay vì dùng chung `FluidChoiceBar`.
     - `SellerProducts` (`SellerScreens.tsx:292`) có `.seller-products-list > .table-scroll` bo `10px` lọt thỏm bên trong Card thay vì flush hoặc đồng nhất bo góc.
     - `AuctionOperations.tsx` (dòng `255`, `289`, `326`, `349`) tự ghi đè `style={{ borderRadius: "10px" }}` lên `<Card>`.
  3. **Mã màu cũ & Inline styles (`globals.css` + `SellerScreens.tsx`):**
     - `globals.css:1614-1725` cho Seller studio (`.seller-image-dropzone`, `.seller-image-preview-card.is-primary`, `.seller-variant-card.is-default`, `.seller-warehouse-choice:hover`) còn dùng mã xanh dương cũ `#7dd3fc`, `#f8fdff`, `#f8fcff`.
     - `SellerScreens.tsx` dùng nhiều màu inline cứng (`#059669`, `#b45309`, `#dc2626`, `#047857`, `#f8fafc`).
  4. **Icon Sidebar Seller (`navigation.ts:27-39`):**
     - Hiện `sellerNavigation` dùng trùng lặp `"users"` (Hồ sơ gian hàng, Đánh giá & uy tín), `"warehouse"` (Quản lý kho, Vận chuyển), `"orders"` (Đơn bán, Hoàn tiền, Mã giảm giá), `"gavel"` (Phiên đấu giá, Đơn đấu giá). Cần gán đúng icon riêng biệt đã có trong `Icon.tsx`.
  5. **Breadcrumbs thiếu route (`Breadcrumbs.tsx`):** Thiếu `/seller/refunds`, `/seller/auction-orders`, `/seller/products/auction/new`.

## 3. Phân tích phạm vi ảnh hưởng (Impact Analysis)
- Theo GitNexus `impact Card`, `NavLinks`, cập nhật class `.portal-shell` hoặc thêm `portal-shell-operations` cho Seller trong `Shells.tsx` sẽ ảnh hưởng toàn bộ 18 route dưới `src/app/(dashboard)/seller/`.
- Không thay đổi bất kỳ contract API, validation, hay luồng tạo/sửa sản phẩm, đấu giá, kho, đơn hàng, rút tiền nào.

## 4. Danh sách Route & Tệp tác động
- **Routes (18 trang):** `/seller/products`, `/seller/products/new`, `/seller/products/auction/new`, `/seller/products/[id]`, `/seller/products/[id]/edit`, `/seller/shop`, `/seller/inventory`, `/seller/orders`, `/seller/orders/[id]`, `/seller/shipments`, `/seller/shipments/[id]`, `/seller/refunds`, `/seller/auctions`, `/seller/auctions/new`, `/seller/auctions/[id]`, `/seller/auctions/[id]/edit`, `/seller/auctions/[id]/recreate`, `/seller/auctions/[id]/result`, `/seller/auction-orders`, `/seller/wallet`, `/seller/withdrawals`, `/seller/coupons`, `/seller/reviews`, `/seller/notifications`.
- **Tệp chính:** `Shells.tsx`, `navigation.ts`, `Breadcrumbs.tsx`, `globals.css`, `SellerScreens.tsx`, `SellerProductDetailScreen.tsx`, `SellerAuctionProductCreate.tsx`, `AuctionOperations.tsx`, `SellerAuctionOrders.tsx`, `WalletOperationsScreens.tsx`, `SellerWithdrawalForm.tsx`, `SellerReviewsScreen.tsx`, `VoucherManager.tsx`, `RefundsScreen.tsx`.

## 5. Checklist Triển khai (Step-by-Step)

### Pha 1: Đồng bộ Shell, Card & Sidebar Icons cho Seller
- [ ] **Task 1.1:** Trong `src/components/layout/Shells.tsx`, áp dụng `.portal-shell-operations` cho cả `Người bán` (hoặc nâng cấp chung `.portal-shell .portal-main .card` trong `globals.css`) để Seller dùng chung style `border-radius: 20px` + kính mờ như `/admin/withdrawals`.
- [ ] **Task 1.2:** Cập nhật icon chính xác cho `sellerNavigation` trong `src/constants/navigation.ts`:
  - `Quản lý sản phẩm` -> `"package"`
  - `Hồ sơ gian hàng` -> `"store"`
  - `Quản lý kho` -> `"warehouse"`
  - `Đơn bán` -> `"orders"`
  - `Vận chuyển` -> `"truck"`
  - `Hoàn tiền` -> `"rotateCcw"`
  - `Phiên đấu giá` -> `"gavel"`
  - `Đơn đấu giá` -> `"checkSquare"`
  - `Doanh thu & ví` -> `"wallet"`
  - `Mã giảm giá` -> `"ticket"`
  - `Đánh giá & uy tín` -> `"star"`
- [ ] **Task 1.3:** Bổ sung đầy đủ labels `/seller/refunds`, `/seller/auction-orders`, `/seller/products/auction/new` vào `src/components/layout/Breadcrumbs.tsx`.
- 🔄 **Phase 1 Gate:** Kiểm tra sidebar Seller và bo góc Card chuẩn, chạy `npm run typecheck`.

### Pha 2: Chuẩn hóa Toàn bộ Màn hình Seller & Studio CSS
- [ ] **Task 2.1:** Thay thế toàn bộ mã màu xanh dương cũ trong Seller CSS (`globals.css:1059, 1614-1725`: `#7dd3fc`, `#f8fdff`, `#f8fcff`) bằng token `--primary`, `--primary-soft`, `--primary-border`, `--surface`.
- [ ] **Task 2.2:** Chuẩn hóa bảng & bộ lọc ở `SellerScreens.tsx` (`SellerProductsScreen`, `SellerInventoryScreen`, `SellerOrdersScreen`, `SellerShipmentsScreen`): chuyển tab `.order-tabs` sang `FluidChoiceBar`, đảm bảo `<Card>` + `<div className="table-scroll">` bo góc khớp hoàn toàn, bỏ border-bottom dòng cuối.
- [ ] **Task 2.3:** Chuẩn hóa `AuctionOperations.tsx` (bỏ `style={{ borderRadius: "10px" }}` trên `<Card>`), `SellerAuctionOrders.tsx`, `SellerWithdrawalForm.tsx`, `WalletOperationsScreens.tsx`, `SellerProductDetailScreen.tsx`, `SellerReviewsScreen.tsx` về một form thống nhất với `DESIGN.md`.
- 🔄 **Phase 2 Gate:** Chạy `npm run typecheck`, `npm run lint`, `npm run build`.

## 6. Kiểm chứng (Verification)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
```
