# KẾ HOẠCH: GIAO DIỆN ADMIN QUẢN LÝ VẬN ĐƠN & GIẢ LẬP SHIPPER GHN (SANDBOX SIMULATOR)
> **Vị trí lưu trữ quy chuẩn:** `.agents/plans/2026-11-26_1430-plan-admin-shipment-simulator.md`  
> **Dự án:** `Nexus-Fe` (`/admin/shipments`).

- ⏱️ **Thời gian lập kế hoạch:** Thứ Năm, 26/11/2026, 14:30 (UTC+7)
- ⏱️ **Thời gian hoàn tất:** Thứ Năm, 26/11/2026, 14:45 (UTC+7)

---

## 1. Mục Tiêu (Objective)
1. Cung cấp màn hình quản trị Admin tại `/admin/shipments` để tra cứu chi tiết vận đơn toàn sàn.
2. Cho phép Admin nhập mã vận đơn GHN hoặc SubOrder ID và cập nhật/giả lập các mốc trạng thái bưu tá GHN (`picked`, `delivering`, `delivered`, `delivery_fail`, `returning`, `returned`, `cancel`).
3. Tự động đồng bộ sang CommerceService để đổi trạng thái đơn con SubOrder (`Shipping` khi `delivering`, `Delivered` khi `delivered`), cho phép kiểm thử toàn bộ luồng Người mua xác nhận đã nhận hàng & đánh giá đơn mà không cần shipper thật.
4. Tích hợp liên kết tra cứu và quản lý đơn trên Cổng GHN 5 Sao (`https://5sao.ghn.dev/`) và tài liệu API GHN (`https://developer.ghn.dev/vi`).

---

## 2. Checklist Triển Khai (Implementation Checklist)
- [x] **2.1 (Frontend Types & Service):**
  - Thêm types: `SimulateShipperStatusParams`, `SimulateShipperStatusResult`, `ShipmentFilterQuery`, `PagedShipments` vào `src/features/fulfillment/types/index.ts`.
  - Thêm 2 phương thức: `simulateShipperStatus` và `listShipments` vào `src/features/fulfillment/services/fulfillment.service.ts`.
  - Thêm helper màu sắc `shipmentStatusTone` vào `src/features/fulfillment/shipment-labels.ts`.
- [x] **2.2 (Frontend Admin Screen):**
  - Xây dựng màn hình `src/features/admin/AdminShipmentsScreen.tsx` với:
    - Form tra cứu vận đơn & giả lập trạng thái shipper GHN Sandbox.
    - Hỗ trợ đổi trạng thái kèm Force Override khi cần nhảy cóc.
    - Card chi tiết vận đơn hiện tại kèm lịch sử sự kiện (Events timeline).
    - Nút in phiếu GHN chọn khổ `A5`, `80x80`, `52x70`.
    - Bảng danh sách vận đơn gần đây kèm phân trang và nút "Chọn đơn này".
    - Link nhanh tới Cổng GHN 5 Sao (`https://5sao.ghn.dev/`) và Tài liệu API GHN (`https://developer.ghn.dev/vi`).
- [x] **2.3 (Routing & Navigation):**
  - Thêm `ROUTES.admin.shipments: "/admin/shipments"`.
  - Thêm menu vào `adminNavigation` và workspace card vào `AdminScreens.tsx`.
  - Tạo route `src/app/(dashboard)/admin/shipments/page.tsx` và export `AdminShipmentsScreenClient` trong `ClientScreens.tsx`.
- [x] **2.4 (Kiểm Chứng):**
  - `npm run typecheck` đạt 0 errors.
  - `node --test tests/*.test.mjs` đạt 196/196 tests pass.
  - `npm run build` biên dịch thành công 97/97 routes.
