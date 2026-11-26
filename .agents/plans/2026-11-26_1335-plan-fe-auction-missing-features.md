# Kế Hoạch: Tích Hợp Chức Năng Báo Cáo Phiên Đấu Giá & Thống Kê Seller Trên Frontend (Nexus-Fe)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-26_1335-plan-fe-auction-missing-features.md`  
> **Dự án tác động:** `Nexus-Fe` (Next.js 16 App Router)  
> **Căn cứ nghiệp vụ:** `docs/06_FE_AUCTION_MISSING_APIS.md` (tại Backend repo)  
> **Trạng thái:** Đã qua kiểm định công kích `/interrogate` — Khắc phục triệt để các lỗ hổng sai enum, ảo giác DTO và xung đột định tuyến Gateway.  
> **Ràng buộc:** Giữ nguyên các chức năng khác, bảo đảm `npm run build` hoàn tất 0 lỗi.

- ⏱️ **Thời gian lập kế hoạch:** Thứ Năm, 26/11/2026, 13:35 (UTC+7)
- ⏱️ **Thời gian công kích & hoàn thiện:** Thứ Năm, 26/11/2026, 13:52 (UTC+7)

---

## 1. Mục Tiêu Đã Tinh Chỉnh (Refined Objectives)
1. **Chức năng Báo cáo vi phạm phiên đấu giá phía Buyer:**
   - Expose phương thức `report(id, body)` trong `auction.service.ts` gọi `POST /api/v1/auctions/{id}/reports`.
   - Tạo component Modal `AuctionReportModal.tsx` với danh sách lý do chuẩn theo đúng C# enum `AuctionReportReason` (tránh lỗi 400 JsonException do văn bản tự do).
   - Validate mô tả client-side: $10 \le \text{độ dài} \le 1000$ ký tự.
   - Thêm nút `[🚩 Báo cáo vi phạm]` trên `AuctionRoomScreen` (`AuctionPages.tsx`).
   - Rào chắn hiển thị: Chỉ hiển thị khi người dùng đã đăng nhập, có quyền đặt giá, **không phải chủ phiên** (`auction.sellerId !== user.id`), và phiên ở trạng thái `Scheduled` hoặc `Running` (tránh lỗi 422 `INVALID_STATE_TRANSITION`).
   - Xử lý mã lỗi HTTP 409 `REPORT_ALREADY_EXISTS` thân thiện.
2. **Khối Thống kê Đấu giá Seller:**
   - Tận dụng component `SellerAuctionStats.tsx` và kiểu dữ liệu chuẩn `SellerAuctionStatistics` (`successfulAuctions`, `failedAuctions`, `completedAuctions`, `successRate`).
   - Nhúng khối thống kê vào đầu trang quản lý phiên của Seller (`OperationsListScreen` trong `AuctionOperations.tsx`), sử dụng `user.id` từ session.
3. **Cô lập xung đột Gateway đối với `GET /api/v1/me/reports`:**
   - Không can thiệp vào `BuyerReportsScreen` hiện hữu để tránh gọi nhầm sang `UserService` (do Gateway định tuyến `/api/v1/me/*` về `UserService`).
4. **Bật bảng điều khiển tua thời gian Admin (`Time Controls`):**
   - Hướng dẫn thiết lập cờ `time-controls` trong biến môi trường `FEATURES` phục vụ buổi demo.

---

## 2. Danh Sách Tệp Sẽ Tạo & Chỉnh Sửa

| STT | Đường dẫn tệp | Hành động | Mục đích |
| :---: | :--- | :---: | :--- |
| **1** | `src/features/auction/types/index.ts` | Chỉnh sửa | Bổ sung enum `AuctionReportReason` chuẩn C#, interface `CreateAuctionReportRequest`, `CreateAuctionReportResponse`. |
| **2** | `src/features/auction/services/auction.service.ts` | Chỉnh sửa | Bổ sung phương thức `report(id, body)` gọi `POST /api/v1/auctions/{id}/reports`. |
| **3** | `src/features/auction/components/AuctionReportModal.tsx` | Tạo mới | Component Modal chọn enum lý do vi phạm tiếng Việt chuẩn và nhập mô tả khiếu nại (10–1000 ký tự). |
| **4** | `src/features/auction/components/index.ts` | Chỉnh sửa | Export `AuctionReportModal`. |
| **5** | `src/features/auction/AuctionPages.tsx` | Chỉnh sửa | Thêm nút `[🚩 Báo cáo vi phạm]` trên thanh tiêu đề `AuctionRoomScreen` với đầy đủ điều kiện rào chắn (`active || scheduled`, `sellerId !== user.id`). |
| **6** | `src/features/auction/AuctionOperations.tsx` | Chỉnh sửa | Hiển thị `<SellerAuctionStats sellerId={user.id} />` ở đầu trang `/seller/auctions`. |

---

## 3. Lộ Trình Triển Khai Phân Tầng (Step-by-Step Implementation)

### GIAI ĐOẠN 1: Bổ Sung Hợp Đồng DTO & Phương Thức API Báo Cáo
- [ ] **Task 1.1:** Cập nhật `src/features/auction/types/index.ts`:
  - Khai báo enum chuẩn theo C# `AuctionReportReason`:
    ```typescript
    export type AuctionReportReason =
      | "SuspectedShillBidding"
      | "CounterfeitOrFake"
      | "MisleadingInfo"
      | "ExternalContact"
      | "Other";
    ```
  - Khai báo DTO gửi và nhận:
    ```typescript
    export type CreateAuctionReportRequest = {
      reason: AuctionReportReason;
      description: string;
    };
    export type CreateAuctionReportResponse = {
      reportId: string;
      auctionId: string;
      reason: AuctionReportReason;
      status: string;
      createdAt: string;
    };
    ```
- [ ] **Task 1.2:** Cập nhật `src/features/auction/services/auction.service.ts`:
  - Thêm phương thức `report`:
    ```typescript
    report: async (id: string, body: CreateAuctionReportRequest): Promise<CreateAuctionReportResponse> =>
      unwrap(await api.post<ApiResponse<CreateAuctionReportResponse> | CreateAuctionReportResponse>(
        `/api/v1/auctions/${idPath(id)}/reports`, body
      )),
    ```
- 🔄 **Cổng Kiểm Tra Giai Đoạn 1 (Phase 1 Check Gate):**
  - Chạy `npm run build` trên `Nexus-Fe` kiểm tra kiểu dữ liệu DTO không lỗi.

---

### GIAI ĐOẠN 2: Xây Dựng Component Modal Báo Cáo & Nút Kích Hoạt Trong Phòng Đấu Giá
- [ ] **Task 2.1:** Tạo mới `src/features/auction/components/AuctionReportModal.tsx`:
  - Mapping nhãn lý do vi phạm tiếng Việt sang giá trị enum chuẩn:
    - `"SuspectedShillBidding"`: "Nghi vấn kích giá ảo / tài khoản phụ"
    - `"CounterfeitOrFake"`: "Nghi vấn hàng giả / hàng nhái"
    - `"MisleadingInfo"`: "Mô tả sản phẩm sai lệch / gian lận"
    - `"ExternalContact"`: "Lôi kéo giao dịch ngoài sàn"
    - `"Other"`: "Lý do khác"
  - Kiểm tra độ dài mô tả trước khi gửi: $10 \le \text{description.trim().length} \le 1000$.
  - Xử lý mã lỗi `REPORT_ALREADY_EXISTS` $\rightarrow$ "Bạn đã gửi báo cáo cho phiên đấu giá này rồi."
  - Bổ sung export tại `src/features/auction/components/index.ts`.
- [ ] **Task 2.2:** Cập nhật `src/features/auction/AuctionPages.tsx` tại `AuctionRoomScreen`:
  - Thêm state `reportOpen`.
  - Trên thanh `PageHeading.action`:
    - Thêm nút `[🚩 Báo cáo phiên]` khi:
      `user && auction && (active || scheduled) && auction.sellerId !== user.id && canBid`
    - Bấm nút kích hoạt mở `AuctionReportModal`.
- 🔄 **Cổng Kiểm Tra Giai Đoạn 2 (Phase 2 Check Gate):**
  - Kiểm tra nút hiển thị đúng điều kiện và popup mở mượt mà, validate chặt chẽ.

---

### GIAI ĐOẠN 3: Tích Hợp Thống Kê Đấu Giá Cho Seller & Cấu Hình Demo
- [ ] **Task 3.1:** Cập nhật `src/features/auction/AuctionOperations.tsx` tại `OperationsListScreen`:
  - Lấy `const { user } = useSession();`.
  - Khi `role === "seller"` và có `user?.id`: Hiển thị `<SellerAuctionStats sellerId={user.id} />` ngay phía trên danh sách phiên để người bán xem: Số phiên thành công, số phiên thất bại và tỷ lệ thành công (%).
- [ ] **Task 3.2:** Bổ sung ghi chú cấu hình biến môi trường `FEATURES`:
  - Khai báo `FEATURES=vouchers,ledger,time-controls` trong `.env.local` của `Nexus-Fe` để kích hoạt bảng điều khiển tua thời gian phục vụ demo.
- 🔄 **Cổng Kiểm Tra Giai Đoạn 3 (Phase 3 Check Gate):**
  - Chạy `npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build` hoàn tất 100% với 0 lỗi.
  - Chạy `git -C /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe diff --stat` đối soát phạm vi thay đổi.

---

## 4. Lệnh Kiểm Chứng (Verification Commands)
```bash
# 1. Kiểm tra biên dịch toàn bộ Frontend
npm --prefix /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe run build

# 2. Kiểm tra giới hạn thay đổi để đảm bảo không đụng chức năng khác
git -C /home/yuikiri/Documents/Code/Yuikiri/Github/Nexus-Fe diff --stat
```
