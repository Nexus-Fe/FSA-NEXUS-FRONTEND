# KẾ HOẠCH: ĐỒNG BỘ PHÍ SHIP, CHỌN CA LẤY HÀNG & IN PHIẾU GHN TRÊN FRONTEND (NEXUS-FE)
> **Vị trí lưu trữ quy chuẩn:** `.agents/plans/2026-11-26_0835-plan-fe-shipping-fee-parity-seller-pickup.md`  
> **Dự án:** `Nexus-Fe` (Next.js 16 App Router)

- ⏱️ **Thời gian lập kế hoạch:** Thứ Năm, 26/11/2026, 02:00 (UTC+7)
- ⏱️ **Thời gian cập nhật gần nhất:** Thứ Năm, 26/11/2026, 08:35 (UTC+7)

---

## 1. Mục Tiêu (Objective)
1. Bổ sung tham số `expectedShippingFee` khi đặt đơn (`POST /api/v1/orders`) và xử lý lỗi `SHIPPING_FEE_MISMATCH` khi phí ship thay đổi.
2. Cho phép người bán (Seller) chọn **Ca lấy hàng GHN** (`GET /api/v1/shipping/pick-shifts`) khi duyệt đơn hàng (`SellerAcceptOrderRequest`).
3. Cung cấp khối giao diện **"Chuẩn bị hàng & Bàn giao GHN"** kèm chức năng in phiếu giao hàng GHN đa khổ giấy (`A5`, `80x80`, `52x70`) với token tươi.
4. Bổ sung bộ kiểm thử TDD cho các quy tắc nhãn trạng thái và thông báo lỗi.

---

## 2. Checklist Các Bước Thực Hiện (Implementation Checklist)
- [x] **2.1 (Dịch vụ GHN trên FE):** Thêm `getPickShifts()` và `getPrintLabel(shipmentId, pageSize)` vào `src/features/fulfillment/services/fulfillment.service.ts`.
- [x] **2.2 (Shipping Fee Parity Guard):**
  - Gửi `expectedShippingFee: quotedShippingFee` trong `BuyerCommerceScreens.tsx`.
  - Cập nhật từ điển lỗi `ERROR_DICTIONARY["SHIPPING_FEE_MISMATCH"]` trong `src/lib/errors/error-messages.ts`.
- [x] **2.3 (Seller Pre-Pickup & Print Label):**
  - Cập nhật `SellerScreens.tsx` và `AuctionOrderSellerActions.tsx`: hiển thị dialog chọn ca lấy hàng trước khi chấp nhận đơn.
  - Hiển thị card chuẩn bị hàng khi đơn ở trạng thái `Confirmed` / `ReadyToPick`.
  - Cung cấp dropdown chọn khổ in (`A5`, `80x80`, `52x70`) và mở link in trực tiếp của GHN.
- [x] **2.4 (Đồng bộ Nhãn Trạng Thái):**
  - Bổ sung bảng trạng thái `AUCTION_ORDER_STATUS` và cập nhật `SUB_ORDER_STATUS` trong `src/lib/status-labels.ts`.
- [x] **2.5 (Kiểm Thử TDD):**
  - Bổ sung test kiểm tra `SHIPPING_FEE_MISMATCH` trong `tests/error-messages.test.mjs` và `tests/checkout-outcome.test.mjs`.
  - Bổ sung test kiểm tra `AUCTION_ORDER_STATUS` và `SUB_ORDER_STATUS` trong `tests/status-labels.test.mjs`.

---

## 3. Kế Hoạch Kiểm Chứng (Verification)
1. **Kiểm tra TypeScript:**
   ```bash
   npm run typecheck
   ```
   *Kết quả: 0 errors.*
2. **Kiểm tra Unit Tests:**
   ```bash
   node --experimental-transform-types --loader ./tests/alias-loader.mjs --test tests/*.test.mjs
   ```
   *Kết quả: 196/196 tests passed (100%).*
