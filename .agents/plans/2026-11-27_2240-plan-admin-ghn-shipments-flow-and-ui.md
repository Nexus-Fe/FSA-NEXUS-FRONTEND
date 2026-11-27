# Kế hoạch Chuẩn hóa Toàn diện Luồng & Giao diện Quản lý Vận đơn GHN ở Admin (BE + FE)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-27_2240-plan-admin-ghn-shipments-flow-and-ui.md`
> **Tham chiếu Design System:** `DESIGN.md`
> **Trạng thái:** Đã hoàn thành (Verified BE + FE + Playwright)

- ⏱️ **Thời gian lập:** Thứ Sáu, 27/11/2026, 22:40 (UTC+7)
- ⏱️ **Thời gian cập nhật:** Thứ Sáu, 27/11/2026, 23:32 (UTC+7)

---

## 1. Mục tiêu (Objective)
Nâng cấp toàn diện trang **Quản lý Vận đơn & Giả lập Shipper (GHN)** (`/admin/shipments`) và các API hỗ trợ ở BE (`FulfillmentService`, `CommerceService`) để đạt chuẩn cả **luồng nghiệp vụ GHN**, **truy vết đầy đủ 2 bên (Seller/Buyer) & quan hệ Order/SubOrder/Sản phẩm**, và **chuẩn Design System (`DESIGN.md`)**:

1. **Chuẩn hóa Luồng Giả lập GHN (BE + FE):**
   - Đồng bộ quy tắc giao thất bại lặp lại (`IsRepeatedFailedAttempt`) ở `FulfillmentService.SimulateShipperStatusAsync` cho khớp `GhnWebhookController`.
   - Thêm **GHN Lifecycle Stepper** 5 mốc chính + nút 1-click **"Chuyển bước kế tiếp"** tự động tính theo trạng thái hiện tại của vận đơn.
   - Phân nhóm trạng thái giả lập thành **Luồng giao hàng chính** và **Xử lý ngoại lệ & hoàn hủy** bằng `<SelectBox>` chuẩn hệ thống; tự động `disabled` các trạng thái không hợp lệ khi chưa bật Force Override.
2. **Chi tiết vận đơn 2 bên (Seller & Buyer) + Popup tương tác:**
   - Hiển thị rõ 2 thẻ tóm tắt **Người giao (Seller)** và **Người nhận (Buyer)** ngay trong khối Chi tiết vận đơn.
   - Bấm vào **Người giao (Seller)** → mở **Popup (Modal)** gồm **2 tab**:
     - **Tab 1 — Thông tin tài khoản:** họ tên, email, SĐT, trạng thái/vai trò, tên gian hàng, hotline, điểm uy tín (`GET /api/v1/admin/users/{sellerId}` + `GET /api/v1/sellers/{sellerId}`).
     - **Tab 2 — Thông tin kho:** mã kho, tên kho, SĐT kho, địa chỉ lấy hàng, mã GHN Shop ID / District / Ward, trạng thái kho (`GET /api/v1/warehouses/{warehouseId}`).
   - Bấm vào **Người nhận (Buyer)** → mở **Popup (Modal)** hiển thị thông tin tài khoản người mua (`GET /api/v1/admin/users/{buyerId}`) + thông tin người nhận trên vận đơn.
3. **Quan hệ `Order` (Đơn cha) ↔ `SubOrder` (Đơn con theo từng Shop/Seller) + Popup chi tiết + Điều hướng Sản phẩm có Back khôi phục ngữ cảnh:**
   - Hiển thị rõ vận đơn thuộc **SubOrder** nào (`subOrderNo` / `subOrderId`) và **Order** cha nào (`orderNo` / `orderId`).
   - Bấm vào **SubOrder** → mở **Popup Chi tiết SubOrder**: danh sách sản phẩm trong shop đó, số lượng, đơn giá tại thời điểm đặt, thành tiền, tạm tính, phí ship, chi tiết giảm giá & **mã giảm giá (voucher) đã dùng**, phương thức thanh toán, tổng tiền.
   - Bấm vào **Order (Đơn cha)** → mở **Popup Chi tiết Order cha**: thông tin tổng quan đơn lớn mà người mua đặt, tổng tiền, mã giảm giá đã áp dụng, và danh sách tất cả **SubOrder** con (mỗi nhóm sản phẩm của 1 shop/seller là 1 SubOrder, highlight đúng SubOrder đang xem và cho phép bấm xem chi tiết từng SubOrder).
   - **Sản phẩm bấm được trực tiếp:** mọi sản phẩm trong chi tiết vận đơn / SubOrder / Order đều là link tới `/catalog/{productId}`. Trước khi chuyển trang (và đồng bộ qua URL query `?code=...&modal=suborder|order`), lưu ngữ cảnh hiện tại để khi bấm **Back** trình duyệt sẽ quay lại đúng trang `/admin/shipments` với đúng vận đơn & popup đang mở.
4. **Chuẩn hóa Font chữ, Nút bấm, Ô Input & Bảng theo `DESIGN.md`:**
   - Tách `AdminShipmentsScreen.css`, xóa toàn bộ inline `fontSize`/`height`/`padding`/`borderRadius` chắp vá.
   - Đồng bộ font `Plus Jakarta Sans` (`--font-ui`) + `tabular-nums`, thay toàn bộ `<select>` thuần bằng `<SelectBox>`, đồng bộ chiều cao `42px` (form) / `36px` (toolbar), chuyển bộ lọc trạng thái sang **pill filter chips (`999px`)**, thanh search bo `999px`, bảng đặt flush trong `<Card>` bo `20px` kèm `<TruncatedText />` & `<CopyableId />`.

---

## 2. Context & Files Liên quan
- **Backend — Fulfillment (`src/Services/Fulfillment/`):**
  - `Fulfillment.Application/Services/Shipment/ShipmentService.cs` (`SimulateShipperStatusAsync`)
  - `tests/Fulfillment.UnitTests/SimulateShipperStatusTests.cs`
- **Backend — Commerce (`src/Services/Commerce/`):**
  - `Commerce.Application/Services/Order/OrderResponses.cs` (thêm tham số tùy chọn `List<AppliedVoucherDetail>? AppliedVouchers = null` vào `SubOrderDetailResponse` & `OrderResponse`)
  - `Commerce.Application/Services/Order/OrderService.cs` (`GetSubOrderDetailAsync`, `GetOrderDetailAsync`: đọc thêm `DiscountUsages` kèm `Discount.Code`, `ScopeType`, `DiscountAmount` để trả về `AppliedVouchers`)
- **Frontend (`Nexus-Fe/`):**
  - `src/features/admin/AdminShipmentsScreen.tsx`
  - `src/features/admin/AdminShipmentsScreen.css` (mới)
  - `src/features/admin/components/AdminShipmentModals.tsx` (mới — tách gọn 3 popup: `SellerDetailModal` 2 tab Tài khoản & Kho, `BuyerDetailModal`, `OrderSubOrderDetailModal` kèm link sản phẩm + khôi phục ngữ cảnh Back)
  - `src/features/admin/services/admin-shipments.service.ts` (mới — gọi API lấy Warehouse, SubOrder detail, Master Order detail, User detail, Seller public profile)

---

## 3. Phân tích Phạm vi Ảnh hưởng (Impact Analysis)
- **Fulfillment BE:** Chỉ bổ sung `|| ShipmentStatusTransitions.IsRepeatedFailedAttempt(previousStatus, targetStatus)` trong `SimulateShipperStatusAsync`; không thay đổi schema DB hay DTO.
- **Commerce BE:** Chỉ bổ sung trailing optional property `AppliedVouchers = null` trên `SubOrderDetailResponse` và `OrderResponse`; 100% tương thích ngược với tất cả callers và tests hiện có.
- **Frontend (`Nexus-Fe`):** Tách component modal và service cục bộ trong `src/features/admin/`, chỉ ảnh hưởng route `/admin/shipments`.

---

## 4. Lộ trình Triển khai (Step-by-Step Implementation Checklist)

### Pha 1: Backend (`FulfillmentService` + `CommerceService`)
- [x] **Bước 1.1:** Cập nhật `Fulfillment` `SimulateShipperStatusAsync` hỗ trợ `IsRepeatedFailedAttempt` + thêm unit test vào `SimulateShipperStatusTests.cs`.
- [x] **Bước 1.2:** Cập nhật `Commerce` `OrderResponses.cs` & `OrderService.cs` trả kèm `AppliedVouchers` (từ `DiscountUsages`) trong `GetOrderDetailAsync` và `GetSubOrderDetailAsync`.
- [x] **Bước 1.3:** Chạy `dotnet build` & `dotnet test` cho cả `Fulfillment.sln` và `Commerce.sln`.

### Pha 2: Frontend Services & Popups (`Nexus-Fe`)
- [x] **Bước 2.1:** Tạo `src/features/admin/services/admin-shipments.service.ts` gom hàm tải chi tiết `Warehouse`, `SubOrder`, `Order`, `AdminUser`, `PublicSeller`.
- [x] **Bước 2.2:** Tạo `src/features/admin/components/AdminShipmentModals.tsx`:
  - `SellerDetailModal`: 2 tab **Thông tin tài khoản** & **Thông tin kho** (dùng `FluidChoiceBar` mode `tabs`).
  - `BuyerDetailModal`: thông tin tài khoản người mua + thông tin nhận hàng trên vận đơn.
  - `OrderSubOrderDetailModal`: hỗ trợ xem cả **SubOrder** và **Order cha** (liệt kê tất cả SubOrder theo từng Shop/Seller, chuyển qua lại giữa Order cha ↔ SubOrder con, hiển thị rõ sản phẩm, đơn giá, tiền hàng, phí ship, mã giảm giá đã dùng, tổng tiền; mọi sản phẩm đều là `<Link href={ROUTES.catalog.product(item.productId)}>` có lưu ngữ cảnh URL để Back về đúng chỗ).

### Pha 3: Frontend `AdminShipmentsScreen` & Design System (`Nexus-Fe`)
- [x] **Bước 3.1:** Tạo `src/features/admin/AdminShipmentsScreen.css` chuẩn hóa 100% font, nút, input, pill filter chips, lifecycle stepper, party cards (Seller/Buyer), Order/SubOrder link bar.
- [x] **Bước 3.2:** Tái cấu trúc `src/features/admin/AdminShipmentsScreen.tsx`:
  - Đồng bộ URL query (`?code=...&modal=...&targetId=...`) để bấm sản phẩm sang `/catalog/{id}` rồi bấm Back trình duyệt tự khôi phục đúng vận đơn & popup đang mở.
  - GHN Lifecycle Stepper + Quick Next Step + `<SelectBox>` phân nhóm trạng thái + disable bước không hợp lệ.
  - Hiển thị 2 bên Người giao (Seller) / Người nhận (Buyer) + Order cha / SubOrder con có nút mở Popup.
  - Bảng danh sách flush trong `<Card>` + `<TruncatedText />` + `<CopyableId />`.

### Pha 4: Kiểm chứng (Verification)
- [x] Chạy `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:session` tại `Nexus-Fe`.
- [x] Kiểm tra trực quan bằng Playwright.

---

## 5. Lệnh Kiểm chứng
```bash
dotnet build /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Be/src/Services/Fulfillment/Fulfillment.sln -c Release
dotnet test /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Be/src/Services/Fulfillment/Fulfillment.sln -c Release
dotnet build /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Be/src/Services/Commerce/Commerce.sln -c Release
dotnet test /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Be/src/Services/Commerce/Commerce.sln -c Release
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run typecheck
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run lint
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run test:session
```
