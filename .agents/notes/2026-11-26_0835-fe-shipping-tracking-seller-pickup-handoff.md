# BẢN GHI LÀM RÕ CHỦ ĐỀ: THEO DÕI VẬN ĐƠN, CHUẨN BỊ HÀNG SELLER & ĐỒNG BỘ PHÍ SHIP (MASTER LOG)
> **Vị trí lưu trữ quy chuẩn:** `.agents/notes/2026-11-26_0835-fe-shipping-tracking-seller-pickup-handoff.md`  
> **Dự án:** `Nexus-Fe` (Next.js 16 App Router)  
> **Phạm vi tác động:** `BuyerCommerceScreens.tsx`, `SellerScreens.tsx`, `AuctionOrderSellerActions.tsx`, `fulfillment.service.ts`, `seller-orders.service.ts`, `status-labels.ts`, `error-messages.ts`.

- ⏱️ **Thời gian bắt đầu chủ đề:** Thứ Năm, 26/11/2026, 02:00 (UTC+7)
- ⏱️ **Thời gian cập nhật gần nhất:** Thứ Năm, 26/11/2026, 08:35 (UTC+7)

---

## 📌 PHẦN 1: Tóm Tắt Các Thành Phần Giao Diện & Dịch Vụ Đã Bổ Sung
- **Mốc thời gian:** 26/11/2026, 03:00 (UTC+7)
1. **Khối Theo Dõi Đơn Hàng (Buyer & Seller):**
   - `OrderProgressStepper.tsx`: Thanh tiến trình 5 nấc chuẩn Shopee: *Đã đặt hàng* -> *Đã thanh toán* -> *Chờ lấy hàng* -> *Đang giao* -> *Đã giao*.
   - `ShipmentTimelineList.tsx`: Nhật ký hành trình thời gian thực đọc từ lịch sử vận đơn GHN (`ShipmentTimelineEntry`).
   - `TrackingCodeBar.tsx`: Hiển thị mã vận đơn GHN, nút copy nhanh, badge trạng thái và nút In phiếu giao hàng trực tiếp.
2. **Khối Chuẩn Bị Hàng & Bàn Giao GHN Cho Người Bán (`SellerScreens.tsx` & `AuctionOrderSellerActions.tsx`):**
   - Khi đơn ở trạng thái `Confirmed` / `ReadyToPick`: Card màu hổ phách/cam hiển thị:
     - Lịch bưu tá dự kiến tới lấy (`Ca lấy hàng GHN`).
     - Danh sách các mặt hàng / SKU / số lượng cần đóng gói và dán mã.
     - Nút in phiếu giao hàng mở dialog chọn khổ giấy: `A5`, `80x80`, `52x70` gọi API backend để nhận token in tươi mở trực tiếp URL của GHN.
3. **Bảo Vệ Chống Lệch Phí Ship (Shipping Fee Parity Guard):**
   - Khi gọi `POST /api/v1/orders`, `BuyerCommerceScreens.tsx` gửi kèm `expectedShippingFee: quote.totalShippingFee`.
   - Nếu backend trả lỗi `SHIPPING_FEE_MISMATCH` (HTTP 409), FE tự động hiển thị thông báo tiếng Việt: *"Phí vận chuyển đã thay đổi so với báo giá ban đầu. Vui lòng lấy lại báo giá mới để tiếp tục đặt hàng."*, đồng thời xóa báo giá cũ để buyer bấm lấy lại báo giá cập nhật.

---

## 📌 PHẦN 2: Lưu Ý Kỹ Thuật Dành Cho Agent Kế Tiếp (Handoff Note for Future Agents)
- **Mốc thời gian:** 26/11/2026, 08:35 (UTC+7)
1. **Lệnh kiểm tra TypeScript:**
   ```bash
   npm run typecheck
   ```
2. **Lệnh chạy Unit Test Node.js:**
   ```bash
   node --experimental-transform-types --loader ./tests/alias-loader.mjs --test tests/*.test.mjs
   ```
   *Hiện tại toàn bộ 196 unit tests đều pass 100%.*
3. **Quy tắc về Nhãn trạng thái (`status-labels.ts`):**
   - `AUCTION_ORDER_STATUS` và `SUB_ORDER_STATUS` đã được đồng bộ với enum backend CommerceService. Không hiển thị code tiếng Anh thô hay mã SCREAMING_SNAKE_CASE trên UI.
4. **Token in phiếu GHN:**
   - Luôn gọi qua `fulfillmentService.getPrintLabel(shipmentId, pageSize)`. Backend sẽ sinh token mới từ GHN để đảm bảo không bị lỗi token hết hạn sau 30 phút.

---

## ❓ KHU VỰC THẮC MẮC DỞ DANG (PENDING DOUBTS)
- [x] **THẮC-MẮC-01:** Khổ giấy in nào được GHN hỗ trợ? -> Đã giải quyết: `A5`, `80x80`, `52x70`.
- [x] **THẮC-MẮC-02:** Xử lý thế nào khi phí ship thay đổi tại thời điểm đặt đơn? -> Đã giải quyết: Bắt mã `SHIPPING_FEE_MISMATCH`, thông báo rõ cho người dùng và xóa báo giá cũ.

---

## 🚀 TRẠNG THÁI HIỆN TẠI (CURRENT STATE)
- **Chủ đề đang xử lý:** Hoàn tất bổ sung unit tests TDD cho `status-labels.test.mjs`, `error-messages.test.mjs`, và `checkout-outcome.test.mjs`.
- **Trạng thái:** 196 tests passed, TypeScript clean 100%.
