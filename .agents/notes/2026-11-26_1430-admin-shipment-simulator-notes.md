# BẢN GHI LÀM RÕ CHỦ ĐỀ: GIAO DIỆN ADMIN QUẢN LÝ VẬN ĐƠN & GIẢ LẬP SHIPPER GHN (MASTER LOG)
> **Vị trí lưu trữ quy chuẩn:** `.agents/notes/2026-11-26_1430-admin-shipment-simulator-notes.md`  
> **Dự án:** `Nexus-Fe`  
> **Phạm vi tác động:** `/admin/shipments`, `AdminShipmentsScreen.tsx`.

- ⏱️ **Thời gian bắt đầu chủ đề:** Thứ Năm, 26/11/2026, 14:30 (UTC+7)
- ⏱️ **Thời gian cập nhật gần nhất:** Thứ Năm, 26/11/2026, 14:45 (UTC+7)

---

## 📌 PHẦN 1: Bối Cảnh Yêu Cầu & Giải Pháp
- **Mốc thời gian:** 26/11/2026, 14:30 (UTC+7)
- **Nội dung người dùng trao đổi:**
  - Yêu cầu thêm giao diện ở Admin giúp Admin nhập mã đơn hàng (hoặc mã vận đơn GHN) và cập nhật trạng thái (ví dụ đã lấy hàng, đang giao, đã giao) để test toàn bộ luồng mà không cần shipper thật ngoài đời.
  - Tham khảo API tại `https://developer.ghn.dev/vi` và Cổng quản lý đơn hàng GHN tại `https://5sao.ghn.dev/`.
  - Triển khai và push lên nhánh `dev` của repository Frontend (`Nexus-Fe`).
- **Giải pháp kỹ thuật đã triển khai:**
  - Thêm màn hình `/admin/shipments` (`AdminShipmentsScreen.tsx`) với đầy đủ form giả lập shipper GHN và danh sách vận đơn toàn sàn.
  - Tích hợp liên kết mở cổng GHN 5 Sao (`https://5sao.ghn.dev/`) và tài liệu GHN (`https://developer.ghn.dev/vi`).

---

## 📌 PHẦN 2: Lời Nhắn Bàn Giao Cho Các Agent Kế Tiếp (Handoff Note for Future Agents)
- **Mốc thời gian:** 26/11/2026, 14:45 (UTC+7)
- **Kính gửi Agent tiếp theo:**
  1. Màn hình quản trị vận đơn và giả lập shipper GHN nằm tại route `/admin/shipments`.
  2. Endpoint backend xử lý: `POST /api/v1/shipments/{trackingNumber}/simulate-shipper-status` (hoặc `POST /api/v1/shipments/simulate-shipper-status`).
  3. Khi cập nhật trạng thái sang `delivering`, SubOrder trong Commerce tự động chuyển sang `Shipping`.
  4. Khi cập nhật trạng thái sang `delivered`, SubOrder trong Commerce tự động chuyển sang `Delivered`, cho phép người mua truy cập `/buyer/orders/[id]` để bấm **"Đã nhận được hàng"** và **"Đánh giá đơn hàng"**.
  5. Cổng GHN 5 Sao để đối soát mã vận đơn thật/test: `https://5sao.ghn.dev/`.

---

## ❓ KHU VỰC THẮC MẮC DỞ DANG (PENDING DOUBTS)
- [x] **THẮC-MẮC-01:** Làm sao để test giao hàng khi không có shipper thật? -> Đã giải quyết: Sử dụng màn hình `/admin/shipments` hoặc gọi API `simulate-shipper-status`.

---

## 🚀 TRẠNG THÁI HIỆN TẠI (CURRENT STATE)
- **Chủ đề đang xử lý:** Hoàn tất triển khai màn hình Admin Quản lý vận đơn & Giả lập shipper GHN.
- **Trạng thái kiểm thử:** 
  - Frontend: 196/196 tests passed, 0 error typecheck, build thành công 97 routes.
