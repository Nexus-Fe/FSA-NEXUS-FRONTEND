# Báo Cáo Đối Soát & Công Kích (/interrogate): Các API và Chức Năng Đấu Giá Trên Frontend

- ⏱️ **Thời gian lập:** Thứ Năm, 26/11/2026, 13:35 (UTC+7)
- ⏱️ **Thời gian công kích & cập nhật:** Thứ Năm, 26/11/2026, 13:50 (UTC+7)
- 📁 **Vị trí lưu trữ:** `.agents/notes/2026-11-26_1335-doi-soat-api-auction-va-giao-dien-fe.md`
- 🎯 **Tài liệu đối soát:** `docs/06_FE_AUCTION_MISSING_APIS.md` (tại Backend repo)
- ⚔️ **Phương pháp:** `/interrogate` — Tìm kiếm các lỗ hổng giả định, xung đột định tuyến (routing collision), sai lệch kiểu dữ liệu (data contract mismatch) và điều kiện biên nghiệp vụ trước khi code.

---

## 1. Kết Quả Công Kích & Các Lỗ Hổng Được Xác Minh (Verified Findings)

### 🔴 Lỗ hổng 1: Sai lệch định dạng Enum `Reason` trong tài liệu `docs/06_FE_AUCTION_MISSING_APIS.md`
- **Giả định sai trong doc:** Tài liệu đưa ví dụ body JSON gửi lên backend:
  ```json
  { "reason": "Suspected Shilling / Fake Bids", "description": "..." }
  ```
- **Thực tế mã nguồn C# (`AuctionReportReason.cs`):** Backend định nghĩa enum strongly-typed:
  ```csharp
  public enum AuctionReportReason {
      SuspectedShillBidding = 0,
      CounterfeitOrFake = 1,
      MisleadingInfo = 2,
      ExternalContact = 3,
      Other = 4
  }
  ```
- **Hậu quả nếu code theo doc:** `PascalCaseJsonStringEnumConverter` của ASP.NET Core sẽ văng ngoại lệ `JsonException` và trả về HTTP 400 Bad Request (`VAL_INVALID_INPUT` / `VAL_INVALID_REASON`).
- **Khắc phục:** Frontend phải hiển thị nhãn tiếng Việt trên giao diện nhưng `value` gửi lên API bắt buộc phải là enum PascalCase chuẩn:
  - *"Nghi vấn kích giá ảo / thông đồng"* $\rightarrow$ `"SuspectedShillBidding"`
  - *"Nghi vấn hàng giả / hàng nhái"* $\rightarrow$ `"CounterfeitOrFake"`
  - *"Thông tin mô tả sai lệch / gian lận"* $\rightarrow$ `"MisleadingInfo"`
  - *"Lôi kéo giao dịch ngoài sàn"* $\rightarrow$ `"ExternalContact"`
  - *"Lý do khác"* $\rightarrow$ `"Other"`

---

### 🔴 Lỗ hổng 2: Ảo giác cấu trúc dữ liệu trả về của API Thống kê Seller (`auction-statistics`)
- **Giả định sai trong doc:** Tài liệu mô tả response chứa các trường: `totalAuctions`, `cancelledAuctions`, `totalRevenueAmount`.
- **Thực tế mã nguồn C# (`AuctionDtos.cs:26`):** Record `SellerAuctionStatisticsDto` chỉ chứa đúng 5 trường:
  ```csharp
  public sealed record SellerAuctionStatisticsDto(
      Guid SellerId,
      int SuccessfulAuctions,
      int FailedAuctions,
      int CompletedAuctions,
      decimal? SuccessRate);
  ```
- **Hậu quả nếu code theo doc:** Đọc `stats.totalAuctions` hay `stats.totalRevenueAmount` sẽ bị `undefined` / `NaN`.
- **Khắc phục:** Sử dụng đúng kiểu `SellerAuctionStatistics` đã khai báo sẵn trong `src/features/auction/seller-stats.ts` (`successfulAuctions`, `failedAuctions`, `completedAuctions`, `successRate`).

---

### 🔴 Lỗ hổng 3: Xung đột định tuyến Gateway (Routing Shadowing) đối với `GET /api/v1/me/reports`
- **Vấn đề:** Tài liệu đề xuất FE gọi `GET /api/v1/me/reports` để xem lại các báo cáo đấu giá của Buyer.
- **Thực tế mã nguồn Gateway & Backend:**
  - `UserService` sở hữu `GET /api/v1/me/reports` (`MeController.cs:135`) để xem báo cáo vi phạm người dùng (`UserReports`).
  - `AuctionService` cũng khai báo `[HttpGet("~/api/v1/me/reports")]` (`AuctionsController.cs:486`).
  - Tại Gateway `appsettings.json`, tuyến `/api/v1/me/{**catch-all}` có `Order: 0` chuyển tiếp toàn bộ yêu cầu về `user-cluster` (`UserService`). Gateway **không có route riêng** cho Auction reports cá nhân.
- **Bằng chứng:** Test suite `Gateway.Tests` xác nhận `/api/v1/me/*` đi vào `user-cluster`.
- **Hậu quả:** Nếu FE gọi `GET /api/v1/me/reports` thì 100% request rơi vào `UserService` và nhận về dữ liệu của `UserReports` (sai schema và không có báo cáo đấu giá).
- **Khắc phục:**
  - Không nhồi `GET /api/v1/me/reports` của Auction vào trang Báo cáo hiện tại khi Gateway chưa có route riêng (tránh phá vỡ màn hình `/buyer/reports` hiện hữu).
  - Ưu tiên tập trung vào chức năng Gửi báo cáo (`POST /api/v1/auctions/{id}/reports`) và Thống kê Seller (`GET /api/v1/sellers/{id}/auction-statistics`).

---

### ⚠️ Lỗi tiềm ẩn 4: Ràng buộc nghiệp vụ kiểm tra điều kiện báo cáo phiên đấu giá
- **Thực tế mã nguồn C# (`AuctionService.cs:675`):**
  1. Chỉ phiên ở trạng thái `Scheduled` hoặc `Running` mới được báo cáo; nếu phiên đã kết thúc/hủy, backend trả về **HTTP 422** `INVALID_STATE_TRANSITION`.
  2. Seller không được tự báo cáo phiên của mình; backend trả về **HTTP 403** `SELLER_CANNOT_REPORT`.
  3. Mỗi người dùng chỉ được báo cáo 1 lần cho 1 phiên; gửi lần 2 backend trả về **HTTP 409** `REPORT_ALREADY_EXISTS`.
  4. Mô tả `description` bắt buộc từ 10 đến 1000 ký tự; vi phạm backend trả về **HTTP 400** `VAL_INVALID_DESCRIPTION`.
- **Khắc phục trên FE:**
  - Nút báo cáo chỉ hiển thị khi `(active || scheduled) && auction.sellerId !== user.id`.
  - Client-side validation: bắt buộc `description.trim().length >= 10 && description.trim().length <= 1000`.
  - Bắt lỗi HTTP 409 và hiển thị thông báo tiếng Việt: *"Bạn đã gửi báo cáo cho phiên đấu giá này rồi."*

---

## 2. Bảng Đối Soát Tổng Hợp Sau Công Kích

| API / Tính năng | Endpoint chuẩn | Ràng buộc nghiệp vụ đã thẩm định | Trạng thái tích hợp FE |
| :--- | :--- | :--- | :--- |
| **Gửi tố cáo phiên** | `POST /api/v1/auctions/{id}/reports` | Enum: `SuspectedShillBidding`, `CounterfeitOrFake`, `MisleadingInfo`, `ExternalContact`, `Other`. Mô tả $\ge 10$ ký tự. Chỉ khi phiên `Scheduled`/`Running`. Không phải chủ phiên. | Chưa có UI $\rightarrow$ Triển khai Modal & Nút bấm trên `AuctionRoomScreen` |
| **Thống kê đấu giá Seller** | `GET /api/v1/sellers/{sellerId}/auction-statistics` | Chỉ có 4 số liệu: `successfulAuctions`, `failedAuctions`, `completedAuctions`, `successRate`. | Đã có component `SellerAuctionStats.tsx` $\rightarrow$ Nhúng vào `/seller/auctions` |
| **Xem lại báo cáo của tôi** | `GET /api/v1/me/reports` | Xung đột route với `UserService` tại Gateway. | Giữ nguyên trang báo cáo `UserService`, chờ cấu hình Gateway tách route |
| **Tua thời gian Admin** | `PATCH /schedule`, `PATCH /settlement-deadlines` | Bật cờ `FEATURES=time-controls` trên FE và `AdminTimeControls__Enabled=true` trên BE. | Đã có sẵn component, chỉ cần bật cờ môi trường khi demo |
