# Kế hoạch Sửa Lỗi Buyer Header/Nav, Gom Nhóm Seller Sidebar & Chuẩn hóa Thanh Tìm kiếm (Nexus-Fe)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2125-plan-fe-header-nav-seller-sidebar-search.md`
> **Tham chiếu Design System:** `DESIGN.md`
> **Trạng thái:** Hoàn thành (Đã kiểm chứng build, lint, test & Playwright)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 21:25 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 21:35 (UTC+7)

---

## 1. Mục tiêu (Objective)
Xử lý dứt điểm 4 vấn đề giao diện trên `Nexus-Fe`:
1. **Sửa lỗi tràn ngang thanh điều hướng Buyer (`.buyer-nav-wrap` / `.top-nav`)**: Không để các mục điều hướng (đặc biệt nút active cuối hàng như `Uy tín của tôi`) tràn khỏi khung kính khi thu nhỏ cửa sổ trong dải `1100px–1360px`; tự động xuống dòng gọn gàng và chuyển bo góc phù hợp ngay khi không đủ chiều ngang.
2. **Gom nhóm & sắp xếp lại Seller Sidebar theo chuẩn Admin/Staff**: Chuyển `sellerNavigation` từ danh sách phẳng 11 mục sang cấu trúc `sellerNavigationSections: NavigationSection[]` gồm 5 nhóm nghiệp vụ rõ ràng (hỗ trợ đóng/mở nhóm, tự động mở nhóm đang active giống hệt Admin & Staff).
3. **Tinh chỉnh Top Header Buyer (Đơn mua, Giỏ hàng, Chuông thông báo, khoảng cách)**:
   - Tạo nền holder dạng pill nhẹ cho `Đơn mua` và `Giỏ hàng` đồng bộ với hệ kính mờ.
   - Thu gọn kích thước nút chuông thông báo (`42px -> 36px`, icon `20px -> 17px`) để cân đối với chiều cao các nút lân cận.
   - Thu hẹp khoảng cách thừa giữa các thành phần trong `.header-actions` và `.account-nav` để cụm điều khiển gọn gàng, thuận mắt.
4. **Chuẩn hóa bo góc các thanh tìm kiếm theo Design System**: Nâng cấp `.header-search` (trang chủ & toàn bộ Buyer shell) từ `10px` (vuông) lên dạng capsule pill `999px` kèm nút submit tròn, hiệu ứng `:focus-within` đồng nhất, và chuẩn hóa bo góc các ô `input[type="search"]` toàn hệ thống.

---

## 2. Context & Nguyên nhân Gốc rễ (Root Cause Evidence)

1. **Buyer Nav tràn khỏi pill khi co màn hình (`src/styles/home-glass.css:14-49, 565-575`)**:
   - `.buyer-nav-wrap` đặt `width: fit-content; max-width: calc(100% - 32px); border-radius: 999px;` trong khi `.top-nav` đặt `overflow: visible;` và **không có `flex-wrap: wrap`** cho tới tận `@media (max-width: 1100px)`.
   - Tổng chiều rộng 9–10 mục của `buyerNavigation` vượt quá `1220px`, nên ở dải `1101px–1320px` các mục cuối bị đâm xuyên ra ngoài viền phải của thanh pill.
2. **Seller Sidebar đang phẳng (`src/constants/navigation.ts:32-44`, `src/components/client/ClientShells.tsx:16-19`)**:
   - `AdminShellClient` và `StaffShellClient` dùng `sections={sections}` (`NavigationSection[]`), còn `SellerShellClient` vẫn dùng `items={items}` phẳng 11 mục nên thiếu phân cấp và khó quét nhanh.
3. **Top Header Buyer rời rạc & chuông to (`src/components/layout/Shells.tsx:417-436`, `src/styles/globals.css:208-221`, `src/features/notification/NotificationBell.css:16-23`)**:
   - `.header-actions` có `gap: 20px`, `.account-nav` có `padding-left: 20px`.
   - `Đơn mua` và `Giỏ hàng` là `<a>` trần không có nền holder, đứng cạnh `.u074-bell` hình tròn trắng `42×42px` (icon `20px`) nên bị lệch trọng lượng thị giác.
4. **Thanh tìm kiếm vuông hơn Design System (`src/styles/globals.css:212-216`, `src/styles/home-glass.css:222-226`)**:
   - `.header-search` dùng `border-radius: 10px` và nút mũi tên `border-radius: 6px`, lạc nhịp với ngôn ngữ pill (`999px`) và thẻ kính (`20px`) của Buyer Home & Marketplace.

---

## 3. Thiết kế Chi tiết (Proposed Design)

### 3.1. Sửa Responsive cho Buyer Nav Pill (`src/styles/home-glass.css`)
- Đặt `.buyer-glass-shell .buyer-nav-wrap .top-nav` có `flex-wrap: wrap; justify-content: center; row-gap: 4px; column-gap: 3px;` (áp dụng ở mọi kích thước, không đợi xuống `1100px`), để ngay khi viewport hẹp hơn tổng chiều rộng mục, mục cuối tự xuống dòng gọn trong khung kính.
- Tinh chỉnh `border-radius` cho `.buyer-nav-wrap`:
  - Desktop rộng (`> 1360px`, 1 dòng): `border-radius: 999px`.
  - Khi có khả năng xuống 2 dòng (`<= 1360px`): chuyển `border-radius: 26px`, `padding: 6px 10px`, và tắt hoặc bo khớp pseudo-element `::before` để viền sáng trên không bị lệch khi có 2 hàng.
- Kiểm tra hoạt động của `fluid-nav-indicator` trong `NavLinks.tsx` khi mục active chuyển giữa dòng 1 và dòng 2 (đảm bảo `offsetTop`/`offsetLeft` cập nhật đúng sau resize).

### 3.2. Gom nhóm Seller Sidebar (`src/constants/navigation.ts`, `src/components/client/ClientShells.tsx`)
Cấu trúc `sellerNavigationSections: NavigationSection[]` (5 nhóm theo đúng luồng vận hành của người bán, đồng bộ style Admin/Staff):
1. **Gian hàng & Sản phẩm** (`id: "seller-catalog"`, icon `package`)
   - `Quản lý sản phẩm` (`/seller/products`, `package`)
   - `Quản lý kho` (`/seller/inventory`, `warehouse`)
   - `Hồ sơ gian hàng` (`/seller/shop`, `store`)
2. **Đơn hàng & Vận chuyển** (`id: "seller-orders"`, icon `bag`)
   - `Đơn bán` (`/seller/orders`, `orders`)
   - `Vận chuyển` (`/seller/shipments`, `truck`)
   - `Hoàn tiền` (`/seller/refunds`, `rotateCcw`, `feature: "refunds"`)
3. **Đấu giá** (`id: "seller-auctions"`, icon `gavel`)
   - `Phiên đấu giá` (`/seller/auctions`, `gavel`)
   - `Đơn đấu giá` (`/seller/auction-orders`, `checkSquare`)
4. **Tài chính & Khuyến mãi** (`id: "seller-finance"`, icon `wallet`)
   - `Doanh thu & ví` (`/seller/wallet`, `wallet`)
   - `Mã giảm giá` (`/seller/coupons`, `ticket`, `feature: "vouchers"`)
5. **Uy tín & Đánh giá** (`id: "seller-reputation"`, icon `star`)
   - `Đánh giá & uy tín` (`/seller/reviews`, `star`)

*(Giữ export `sellerNavigation = sellerNavigationSections.flatMap(...)` để không phá vỡ bất kỳ import nào hiện có.)*

### 3.3. Nâng cấp Buyer Top Header (`Shells.tsx`, `globals.css`, `home-glass.css`, `NotificationBell.css`)
- Thêm class `.header-action-pill` cho link `Đơn mua` và `Giỏ hàng` trong `Shells.tsx`:
  - Chiều cao `36px`, `padding: 0 12px`, `border-radius: 999px`, nền kính sáng nhẹ `color-mix(in srgb, var(--surface) 78%, transparent)`, viền `1px solid color-mix(in srgb, var(--line) 85%, transparent)`, icon `16px`.
  - Hover chuyển nền `var(--primary-soft)`, viền `var(--primary-border)`, chữ `var(--primary)`.
  - Ở mobile (`<= 560px`): thu gọn thành nút tròn `36×36px` chỉ giữ icon gọn gàng.
- Thu gọn `.u074-bell` trong `NotificationBell.css`:
  - `width: 36px; height: 36px;` (khớp chính xác `36px` của `.header-action-pill`), `svg` `17×17px`, badge `min-width: 17px; height: 17px; font-size: 10px; right: -2px; top: -2px;`.
- Thu gọn khoảng cách cụm header:
  - `.buyer-header-inner`: `gap: 16px; min-height: 70px;`
  - `.header-actions`: `gap: 8px;`
  - `.account-nav`: `padding-left: 12px; margin-left: 2px;`

### 3.4. Chuẩn hóa Bo góc Thanh Tìm kiếm (`globals.css`, `home-glass.css`, `DESIGN.md`)
- `.header-search`: nâng cấp từ `border-radius: 10px` lên `border-radius: 999px`, `height: 42px`, `padding: 0 6px 0 16px`, nền kính mờ mềm, hiệu ứng `:focus-within` nổi viền `--primary-border` + halo mảnh.
- `.header-search button`: nút tròn `width: 30px; height: 30px; border-radius: 999px;` đồng bộ với khung pill.
- Các ô `input[type="search"].field` (ví dụ tìm gian hàng `.shop-directory-search .field`, lọc tìm kiếm ở Catalog/Portal): thống nhất bo `999px` cho thanh search độc lập (`shop-directory-search`, `header-search`) và `12px` cho ô input trong form bộ lọc để hài hòa với `DESIGN.md`.

---

## 4. Phân tích Phạm vi Ảnh hưởng (Impact Analysis)
- `src/constants/navigation.ts` & `src/components/client/ClientShells.tsx`: chỉ ảnh hưởng render sidebar của Seller portal; `sellerNavigation` vẫn được giữ nguyên kiểu `NavigationItem[]`.
- `src/components/layout/Shells.tsx`: chỉ thêm class `.header-action-pill` cho 2 link `Đơn mua`, `Giỏ hàng` và chỉnh size icon `19 -> 16`, không đổi route hay logic.
- `src/features/notification/NotificationBell.css`: chỉ thu gọn kích thước nút chuông từ `42px -> 36px`, giữ nguyên popover, animation rung và logic unread.
- `src/styles/globals.css` & `src/styles/home-glass.css`: ảnh hưởng Buyer Header, Buyer Nav Pill, và Search bars.

---

## 5. Lộ trình Triển khai (Step-by-Step Implementation Checklist)

- [x] **Bước 1:** Cập nhật `src/styles/home-glass.css` sửa lỗi tràn ngang `.buyer-nav-wrap` / `.top-nav` (bật wrap sớm, bo `26px` khi xuống hàng, kiểm tra `fluid-nav-indicator`).
- [x] **Bước 2:** Cập nhật `src/constants/navigation.ts` và `src/components/client/ClientShells.tsx` chuyển Seller sidebar sang `sellerNavigationSections` (5 nhóm) theo chuẩn Admin/Staff.
- [x] **Bước 3:** Cập nhật `src/components/layout/Shells.tsx`, `src/styles/globals.css`, `src/styles/home-glass.css`, và `src/features/notification/NotificationBell.css`:
  - Thêm pill holder `.header-action-pill` cho `Đơn mua` và `Giỏ hàng`.
  - Thu gọn `NotificationBell` về `36×36px` (`svg` `17px`).
  - Rút gọn khoảng cách `.buyer-header-inner`, `.header-actions`, `.account-nav`.
- [x] **Bước 4:** Chuẩn hóa bo góc `.header-search` (`999px` + nút tròn `30×30px` + `:focus-within`) và `.shop-directory-search .field` (`999px`); cập nhật `DESIGN.md`.
- [x] **Bước 5 (Kiểm chứng):**
  - Chạy `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:session`.
  - Chạy `node .gitnexus/run.cjs detect-changes --scope all --repo /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe`.
  - Kiểm tra thực tế bằng Playwright trên `1440px`, `1240px`, `1024px`, `780px`, `390px`:
    - Xác nhận `.buyer-nav-wrap` không bị tràn ngang hay cắt nút active ở mọi độ rộng (đặc biệt dải `1100px–1360px`).
    - Xác nhận `.header-search` có `border-radius: 999px`, `.u074-bell` có `36×36px`, `Đơn mua` & `Giỏ hàng` có nền pill holder đều đẹp.
    - Xác nhận Seller Sidebar hiển thị 5 nhóm đóng/mở giống chuẩn Admin Sidebar.

---

## 6. Lệnh Kiểm chứng (Verification Commands)
```bash
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run test:session
```
