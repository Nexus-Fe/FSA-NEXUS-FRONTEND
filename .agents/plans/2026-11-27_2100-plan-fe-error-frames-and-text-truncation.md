# Kế hoạch Bo góc Khung Lỗi & Rút gọn Text/Title kèm Nút `"..."` Toàn Repo Frontend (Nexus-Fe)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2100-plan-fe-error-frames-and-text-truncation.md`
> **Tham chiếu Design System:** `DESIGN.md`
> **Trạng thái:** Hoàn thành (Đã kiểm chứng build, lint, test & Playwright)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 21:00 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 21:20 (UTC+7)

---

## 1. Mục tiêu (Objective)
1. **Bo góc đồng bộ toàn bộ khung thông báo lỗi, cảnh báo, thành công và màn hình trạng thái lỗi/không có quyền:**
   - Nâng cấp toàn bộ `.notice`, `.form-error`, `.notice[role="alert"]`, `.form-success`, `.state-error`, `.route-state`, `.access-state`, và các khối lỗi inline về chuẩn bo góc `16px` / `20px` khớp với ngôn ngữ Frosted Glass trong `DESIGN.md`.
2. **Xử lý triệt để text/title quá dài hoặc khi người dùng thu nhỏ màn hình trên toàn bộ repo FE:**
   - Thay vì để chữ tự xuống nhiều dòng phá vỡ chiều cao card/bảng hoặc tràn sang component kế bên, áp dụng cơ chế cắt 1 dòng có dấu `...` kèm **nút nhỏ `"..."`** xuất hiện tự động khi nội dung bị tràn (`scrollWidth > clientWidth`).
   - Khi thu nhỏ màn hình, người dùng luôn thấy phần đầu đoạn text + nút nhỏ `"..."` bên cạnh; bấm vào `"..."` sẽ mở khung xem toàn bộ nội dung đầy đủ (không kích hoạt click link/row phía dưới, đóng bằng `Escape` hoặc click ngoài).

---

## 2. Context & Kết quả Rà soát Toàn Repo FE

### 2.1. Khung lỗi & Trạng thái chưa đồng bộ bo góc
- `src/styles/globals.css:1052`: `.notice` đang dùng `border-radius: 10px`.
- `src/styles/globals.css:1266-1267`: `.form-error`, `.notice[role="alert"]`, `.form-success` đang dùng `border-radius: 8px` (khá vuông so với thẻ `20px`).
- `src/components/ui/States.tsx`: `<ErrorState>` dùng `.state-error.notice`; khi nằm trong `<Card>` (qua `<DataState>`) cần có khoảng lề và bo góc `16px` để không dính sát viền card `20px`.
- `src/components/ui/RouteStates.tsx` & `src/components/auth/RoleGate.tsx`: `.route-state` và `.access-state` hiện chưa có khung kính bo `20px`.
- Inline `role="alert"` rải rác: `BecomeSellerScreen.tsx` (`borderRadius: 10`), `AdminUsersScreen.tsx` / `StaffReportsScreen.tsx` / `AdminPenaltiesScreen.tsx` (`borderRadius: 6px`/`8px`).

### 2.2. Các vị trí Text / Title dễ tràn, xuống dòng hoặc đè component kế bên
- **Khung dùng chung (4 roles):**
  - `PageHeading` (`h1`), `SectionHeading` (`h2`) trong `src/components/ui/Primitives.tsx` (thiếu `min-width: 0` trên khối chữ, dễ đẩy nút `page-action` khi tiêu đề dài).
  - `Breadcrumbs` (`src/components/layout/Breadcrumbs.tsx`): mục trang hiện tại `[aria-current="page"]` đang dùng `overflow-wrap: anywhere`.
  - `NavLinks` (`src/components/layout/NavLinks.tsx`): nhãn mục sidebar `.nav-link span` và `.side-nav-group-label`.
- **Public & Buyer:**
  - `CatalogScreens.tsx`: tiêu đề sản phẩm `.product-body h3`, brand/category, tiêu đề promo banner.
  - `ProductDetailScreen.tsx`: `h1` tên sản phẩm, sản phẩm liên quan `.product-detail-related-item span`.
  - `ShopsDirectoryScreen.tsx` & `ShopScreen.tsx`: tên gian hàng (`h1`/`h2`), mô tả gian hàng.
  - `BuyerCommerceScreens.tsx`: `.cart-product-title`, tên shop trong nhóm giỏ hàng, `.checkout-item div strong`, tên shop/sản phẩm trong đơn mua.
  - `AuctionPages.tsx`, `BuyerAuctionOrders.tsx`, `MyDepositsScreen.tsx`, `MyWatchlistScreen.tsx`: tiêu đề phiên đấu giá, tên sản phẩm đấu giá.
  - `CommerceScreens.tsx`, `NotificationsScreen.tsx`, `NotificationBell.tsx`: tiêu đề báo cáo, tiêu đề thông báo.
- **Seller:**
  - `SellerScreens.tsx`: tên sản phẩm & thương hiệu (`SellerProductsScreen`), tên sản phẩm/biến thể (`SellerInventoryScreen`), preview sản phẩm (`SellerOrdersScreen`, `SellerShipmentsScreen`), tên gian hàng (`SellerShopScreen`).
  - `SellerProductDetailScreen.tsx`, `SellerAuctionOrders.tsx`, `AuctionOperations.tsx`, `VoucherManager.tsx`: tiêu đề sản phẩm/phiên/voucher.
- **Staff:**
  - `StaffSellersScreen.tsx` (`shopName`, `businessEmail`), `StaffProductModerationScreen.tsx` (tên sản phẩm, danh mục), `StaffProductReportsScreen.tsx` (tên sản phẩm, mô tả), `StaffProductReviewsScreen.tsx` (sản phẩm, nội dung đánh giá), `StaffReportsScreen.tsx`, `StaffWithdrawalsScreen.tsx` (`bankName`, `accountHolderName`, `statusReason`), `AuctionOpsScreen.tsx`.
- **Admin:**
  - `AdminUsersScreen.tsx` (tên, email, username), `AdminCategoriesScreen.tsx` (tên, mô tả), `AdminConfigsScreen.tsx`, `AdminAuctionConfigsScreen.tsx`, `AdminNotificationsScreen.tsx`, `NotificationCenterScreen.tsx`, `AdminPenaltiesScreen.tsx`, `AdminShipmentsScreen.tsx`, `SubsidyBudgetsScreen.tsx`, `AdminAuctionSettlements.tsx`, `OperationsScreens.tsx`, `LedgerScreens.tsx`.

---

## 3. Thiết kế Giải pháp Kỹ thuật (Architecture & Component Design)

### 3.1. Component dùng chung `TruncatedText` (`src/components/ui/TruncatedText.tsx` + `TruncatedText.css`)
- **API gọn nhẹ:**
  ```tsx
  export function TruncatedText({
    text,
    label,
    className,
    maxWidth,
  }: {
    text: string;
    label?: string;
    className?: string;
    maxWidth?: number | string;
  })
  ```
- **Cơ chế hoạt động:**
  1. Wrapper: `display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%;`
  2. Phần text: `<span ref={textRef} className="truncated-text-value">` với `min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`.
  3. Phát hiện tràn động: dùng `ResizeObserver` + `useLayoutEffect` kiểm tra `el.scrollWidth > el.clientWidth + 1` mỗi khi `text` thay đổi hoặc người dùng kéo co giãn màn hình.
  4. Nút nhỏ `"..."`: chỉ hiển thị khi `isTruncated === true` (`flex: 0 0 auto;`, kích thước nhỏ gọn, bo tròn pill, không phá chiều cao dòng). Khi bấm nút `"..."`:
     - Gọi `event.preventDefault(); event.stopPropagation();` để không kích hoạt `<Link>` hay `.clickable-row` bọc ngoài.
     - Mở Popover/Dialog portaled tới `document.body` (`z-index: 1300`) hiển thị đầy đủ đoạn text (không bị `overflow: hidden` của `.card` cắt mất), hỗ trợ đóng bằng `Escape`, click ra ngoài, hoặc nút đóng.

### 3.2. Chuẩn hóa Khung Lỗi & Cảnh báo (`globals.css`, `home-glass.css`, `DESIGN.md`)
- `.notice`, `.form-error`, `.notice[role="alert"]`, `.form-success`, `.state-error`: `border-radius: 16px; padding: 14px 18px;`.
- `.card > .state-error`, `.card > .notice`: tự thêm `margin: 16px;` để tách gọn khỏi góc bo `20px` của `<Card>`.
- `.route-state`, `.access-state`: bọc giao diện kính mờ `border-radius: 20px`, viền `--glass-border`, bóng `--glass-shadow`.

---

## 4. Phân tích Phạm vi Ảnh hưởng (Impact Analysis)
- Tạo mới `TruncatedText.tsx` + `TruncatedText.css` không ảnh hưởng ngược tới code cũ.
- Tích hợp `TruncatedText` vào `PageHeading` và `SectionHeading` (`Primitives.tsx`) tự động bảo vệ tiêu đề của toàn bộ ~103 route; cần kiểm tra `min-width: 0` trên `.page-heading > div:first-child` và `.section-heading > div:first-child` để nút hành động bên phải không bị đẩy.
- Tích hợp `TruncatedText` vào các ô bảng/thẻ tiêu đề cần giữ nguyên `clickable-row` và `<Link>` navigation khi bấm phần text, và chỉ mở full-text popover khi bấm nút `"..."`.

---

## 5. Lộ trình Triển khai (Step-by-Step Implementation Checklist)

### Pha 1: Nền tảng Khung Lỗi Bo tròn & Component `TruncatedText`
- [x] **Task 1.1:** Cập nhật `src/styles/globals.css` & `src/styles/home-glass.css` chuẩn hóa bo góc `16px`/`20px` cho `.notice`, `.form-error`, `.notice[role="alert"]`, `.form-success`, `.state-error`, `.route-state`, `.access-state`, và khoảng lề khi nằm trong `<Card>`.
- [x] **Task 1.2:** Xây dựng `src/components/ui/TruncatedText.tsx` và `src/components/ui/TruncatedText.css` (ResizeObserver, nút `"..."` nhỏ gọn, portal popover xem toàn bộ text, hỗ trợ bàn phím `Escape`, chặn propagation trong Link/Row).
- [x] **Task 1.3:** Tích hợp `TruncatedText` + `min-width: 0` vào `PageHeading`, `SectionHeading` (`Primitives.tsx`) và `Breadcrumbs.tsx`.
- [x] **Task 1.4:** Cập nhật `DESIGN.md` ghi nhận chuẩn khung lỗi bo `16px`/`20px` và chuẩn `TruncatedText`.
- 🔄 **Phase 1 Gate:** Chạy `npm run typecheck`.

### Pha 2: Áp dụng trên Toàn bộ Public & Buyer Screens
- [x] **Task 2.1:** `CatalogScreens.tsx`, `ProductDetailScreen.tsx`, `ShopsDirectoryScreen.tsx`, `ShopScreen.tsx`, `CatalogPromoBanner.tsx` (tên sản phẩm, tên shop, danh mục).
- [x] **Task 2.2:** `BuyerCommerceScreens.tsx`, `AuctionPages.tsx`, `BuyerAuctionOrders.tsx`, `MyDepositsScreen.tsx`, `MyWatchlistScreen.tsx`, `NotificationsScreen.tsx`, `CommerceScreens.tsx` (tiêu đề sản phẩm giỏ hàng, checkout, đơn mua, đấu giá, báo cáo, thông báo).
- [x] **Task 2.3:** Dọn inline `borderRadius: 10` trên khối lỗi ở `BecomeSellerScreen.tsx`.
- 🔄 **Phase 2 Gate:** Chạy `npm run typecheck`.

### Pha 3: Áp dụng trên Toàn bộ Seller Screens
- [x] **Task 3.1:** `SellerScreens.tsx`, `SellerProductDetailScreen.tsx`, `SellerAuctionOrders.tsx`, `AuctionOperations.tsx`, `VoucherManager.tsx` (tên sản phẩm, thương hiệu, biến thể SKU, preview sản phẩm đơn/vận đơn, tên phiên đấu giá, tên voucher).
- 🔄 **Phase 3 Gate:** Chạy `npm run typecheck`.

### Pha 4: Áp dụng trên Toàn bộ Staff & Admin Screens
- [x] **Task 4.1:** Staff screens (`StaffSellersScreen.tsx`, `StaffProductModerationScreen.tsx`, `StaffProductReportsScreen.tsx`, `StaffProductReviewsScreen.tsx`, `StaffReportsScreen.tsx`, `StaffWithdrawalsScreen.tsx`, `AuctionOpsScreen.tsx`) — áp dụng `TruncatedText` cho tên shop, email, tên sản phẩm, mô tả, lý do; dọn inline `borderRadius: 6px` trên khung lỗi/kết quả.
- [x] **Task 4.2:** Admin screens (`AdminUsersScreen.tsx`, `AdminCategoriesScreen.tsx`, `AdminConfigsScreen.tsx`, `AdminAuctionConfigsScreen.tsx`, `AdminNotificationsScreen.tsx`, `NotificationCenterScreen.tsx`, `AdminPenaltiesScreen.tsx`, `AdminShipmentsScreen.tsx`, `SubsidyBudgetsScreen.tsx`, `AdminAuctionSettlements.tsx`, `OperationsScreens.tsx`, `LedgerScreens.tsx`) — áp dụng `TruncatedText` cho tên, email, mô tả, tiêu đề, quy tắc, và chuẩn hóa bo góc khung lỗi inline.
- 🔄 **Phase 4 Gate:** Chạy `npm run typecheck`, `npm run lint`, `npm run build`.

### Pha 5: Kiểm chứng & Nghiệm thu (Verification)
- [x] Chạy `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:session`.
- [x] Chạy `node .gitnexus/run.cjs detect-changes --scope all --repo .`.
- [x] Kiểm tra thực tế bằng Playwright tại `localhost:3000` ở `1440px`, `780px`, `390px`:
  - Đo `borderRadius` của `.notice`, `.form-error`, `.route-state`, `.access-state` đạt `16px` / `20px`.
  - Co giãn viewport để xác nhận tiêu đề dài tự cắt 1 dòng kèm nút `"..."`, bấm `"..."` hiện popover đầy đủ nội dung, và không tràn ngang (`scrollWidth <= innerWidth`).

---

## 6. Lệnh Kiểm chứng (Verification Commands)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run test:session
```
