# Kế hoạch Chuẩn hóa Giao diện Role Buyer, Public Marketplace & Auth/Account

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2030-plan-ui-buyer-public-standardization.md`
> **Tham chiếu Design System:** `DESIGN.md`
> **Trạng thái:** Chờ duyệt triển khai (Plan-First)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 20:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
Chuẩn hóa toàn bộ giao diện Public Marketplace, các trang Buyer và cụm Auth/Account về đúng một hệ thống **Deep Burgundy + Alabaster + Frosted Cream Glass** trong `DESIGN.md`, xử lý triệt để lỗi bo góc bảng dữ liệu (`.table-scroll` / `.data-table`), lỗi bo góc và nền cũ ở giỏ hàng (`/buyer/cart`), và xóa sạch các mã màu xanh dương/xanh lá cũ còn sót trong CSS/TSX.

## 2. Context & Bằng chứng hiện trạng (Code Audit)
- **Tệp tham chiếu đã đọc:** `src/styles/theme.css`, `src/styles/globals.css`, `src/styles/home-glass.css`, `src/components/layout/Shells.tsx`, `src/features/commerce/BuyerCommerceScreens.tsx`, `src/features/wallet/WalletScreen.tsx`, `src/features/auction/MyDepositsScreen.tsx`, `src/features/auction/BuyerAuctionOrders.tsx`, `src/features/reviews/MyReputationScreen.tsx`.
- **Các điểm lệch chuẩn phát hiện được:**
  1. **Giỏ hàng (`/buyer/cart`, `globals.css:648-686`):** `.cart-select-all` dùng `border-radius: 12px 12px 0 0` và nền cứng `#f1f5f9`; `.cart-seller-group:last-child` dùng `border-radius: 0 0 12px 12px`; `.buyer-cart-summary` dùng `border-radius: 12px` thay vì `20px` như các card khác trong `.buyer-glass-shell`.
  2. **Bảng trong Card (`.card` + `.table-scroll`):** `WalletScreen.tsx`, `WalletTopUpHistory.tsx`, `MyDepositsScreen.tsx`, `BuyerAuctionOrders.tsx`, `RefundsScreen.tsx`, `AccountScreens.tsx` đặt `.table-scroll` bên trong `.card`, nhưng `.card` không có `overflow: hidden` và `.buyer-main .table-scroll` đặt `border-radius: 16px` khác với `20px` của `.card`, đồng thời hàng cuối `tr:last-child td` vẫn giữ `border-bottom`.
  3. **Mã màu cũ chưa dọn (`globals.css`):** Còn tồn tại các mã hex xanh dương/xanh lá cũ như `#eff4ff` (`.auction-tile-image`, `.auction-detail-image`), `#7dd3fc` (`.hero-visual`, `.hero-orbit`, `.category-tile:hover`, `.product-detail-related-item:hover`), `#0284c7` / `#e0f2fe` (`.checkout-voucher-chip.is-selected`, `.checkout-voucher-option b`), `#c8e71f` (`.checkout-progress .is-complete`, `.checkout-place-order`), `#f8fbff` (`.checkout-voucher`), `#e3f4ff`/`#0f2b47`/`#007db7` (`.catalog-promo-sky`), `#1e3a8a` (`.auth-split-container` fallback).
  4. **Inline styles & class cũ:** `WalletScreen.tsx` dùng wrapper `className="color-indigo"`; `MyReputationScreen.tsx` và `ReputationDetails.tsx` dùng nhiều màu cứng `#f8fafc`, `#e2e8f0` inline; `CatalogScreens.tsx` (`HomeScreen`, `CatalogScreen`), `ProductDetailScreen.tsx`, `ShopScreen.tsx` cần kiểm tra đồng nhất token nút bấm và thẻ.

## 3. Phân tích phạm vi ảnh hưởng (Impact Analysis)
- Chỉnh sửa `.card`, `.table-scroll`, `.cart-*` và token màu trong `src/styles/globals.css` / `src/styles/home-glass.css` sẽ tác động toàn bộ 28+ route Public, Buyer và Auth/Account.
- Theo kết quả GitNexus `impact Card --direction upstream`, `Card` có độ phủ rộng toàn app (`HIGH` risk), nên các thay đổi ở `.card` và `.table-scroll` phải giữ nguyên padding/overflow ngang (`overflow-x: auto` ở `.table-scroll`) để không cắt mất bảng trên màn hình 390px.

## 4. Danh sách Route & Tệp tác động
- **Public & Marketplace:** `/`, `/catalog`, `/catalog/[id]`, `/shops`, `/shops/[id]`, `/auctions`, `/auctions/[id]`, `/payments/success`, `/payments/cancel`.
- **Buyer:** `/buyer/cart`, `/buyer/checkout`, `/buyer/payment/result`, `/buyer/orders`, `/buyer/orders/[id]`, `/buyer/orders/by-sub/[id]`, `/buyer/orders/[id]/review`, `/buyer/auctions`, `/buyer/auctions/[id]/result`, `/buyer/auctions/[id]/payment`, `/buyer/auction-orders`, `/buyer/deposits`, `/buyer/watchlist`, `/buyer/refunds`, `/buyer/wallet`, `/buyer/wallet/top-up`, `/buyer/wallet/top-up/result`, `/buyer/wallet/top-ups`, `/buyer/wallet/top-ups/[id]`, `/buyer/wallet/transfer`, `/buyer/notifications`, `/buyer/reports`, `/buyer/reputation`, `/buyer/become-seller`.
- **Auth & Account:** `/login`, `/register`, `/account/forgot-password`, `/account/reset-password`, `/account/change-password`, `/account/profile`, `/account/addresses`, `/account/sessions`, `/account/notification-preferences`, `/account/seller-documents`.

## 5. Checklist Triển khai (Step-by-Step)

### Pha 1: Đồng bộ CSS Glass Tokens, Bo góc Cart & Table
- [ ] **Task 1.1:** Trong `src/styles/globals.css` & `src/styles/home-glass.css`, chuẩn hóa `.card` có `overflow: hidden`, `.card > .table-scroll:first-child:last-child` kế thừa bo góc và `.data-table tbody tr:last-child td` bỏ `border-bottom` khi nằm sát đáy card.
- [ ] **Task 1.2:** Chuẩn hóa `/buyer/cart` (`.cart-select-all`, `.cart-seller-group`, `.buyer-cart-summary`, `.cart-empty`): đổi bo góc `12px` -> `20px`, đổi nền `#f1f5f9` của `.cart-select-all` sang `rgba(247, 241, 232, .78)` đồng bộ header bảng, áp dụng kính mờ thống nhất.
- [ ] **Task 1.3:** Thay thế toàn bộ mã màu xanh dương/vàng chanh cũ (`#eff4ff`, `#7dd3fc`, `#0284c7`, `#e0f2fe`, `#c8e71f`, `#f8fbff`, `#0f2b47`, `#007db7`, `#e3f4ff`, `#1e3a8a`) sang token `theme.css` (`--primary`, `--primary-soft`, `--primary-border`, `--primary-accent`, `--surface`, `--hero-bg-deep`).
- 🔄 **Phase 1 Gate:** Kiểm tra không còn mã màu cũ trong `globals.css` / `home-glass.css`, chạy `npm run typecheck`.

### Pha 2: Chuẩn hóa Màn hình Buyer & Auth/Account
- [ ] **Task 2.1:** Rà soát `BuyerCommerceScreens.tsx` (`CartScreen`, `CheckoutScreen`, `OrdersScreen`, `OrderDetailScreen`) và `CheckoutVoucherPanel.tsx` / `CheckoutVoucherPreview.tsx`: bảo đảm nút Đặt hàng, Progress bar, Voucher card dùng đúng token Burgundy/Cream.
- [ ] **Task 2.2:** Rà soát cụm Ví & Đấu giá Buyer (`WalletScreen.tsx`, `WalletTopUpFlow.tsx`, `WalletTopUpHistory.tsx`, `TransferScreen.tsx`, `MyDepositsScreen.tsx`, `BuyerAuctionOrders.tsx`, `MyWatchlistScreen.tsx`, `AuctionPages.tsx`): kiểm tra `<Card>` bọc `.table-scroll`, thống nhất `FluidChoiceBar` cho bộ lọc trạng thái, thống nhất `AdminPagination`.
- [ ] **Task 2.3:** Rà soát cụm Hồ sơ & Phản hồi (`AccountScreens.tsx`, `AuthScreens.tsx`, `AddressBookScreen.tsx`, `MyReputationScreen.tsx`, `ReputationDetails.tsx`, `NotificationsScreen.tsx`, `CommerceScreens.tsx`): thay inline hex `#f8fafc`/`#e2e8f0` bằng class dùng token CSS.
- 🔄 **Phase 2 Gate:** Chạy `npm run typecheck`, `npm run lint`, `npm run build`.

## 6. Kiểm chứng (Verification)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
```
