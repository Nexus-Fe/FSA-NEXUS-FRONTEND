# Tiến độ triển khai FE Phase 2 — 15/11/2026

## Cơ sở và phạm vi

- Roadmap: `design-plans/phase2-selected-fe-roadmap-2026-11-15.md` trên FE `dev` tại `c9ee565`.
- Không thay đổi nghiệp vụ BE. Đã khôi phục đúng 2 thay đổi local cũ trong CatalogService (`ProductRequests.cs`, `ProductService.cs`) theo quyết định về contract Catalog; CatalogService hiện sạch. Chưa commit/push.
- Các màn mới giữ `Card`, `PageHeading`, kiểu nhập và màu Nexus hiện có; dùng layout `split` cho form và trạng thái.

## Tiến độ theo gói

| Gói | Đã triển khai trong FE | Chưa hoàn tất/nghiệm thu |
| --- | --- | --- |
| Catalog | Bỏ `quantity`, `warehouseId` khỏi payload Catalog và ô tồn đầu kỳ trong form sản phẩm/biến thể; thêm `weightGrams` bắt buộc cho sản phẩm, tùy chọn ghi đè cho SKU; chuyển Seller gửi sản phẩm sang `PENDING_APPROVAL`; bỏ form tạo kho nhanh thiếu dữ liệu GHN. Tạo màn sản phẩm đấu giá qua `POST /api/v1/products/auction`, đọc lại SKU từ `/products/auctions/{id}`, upload ảnh và gửi duyệt; có `draftId` trong URL để tiếp tục khi bước sau lỗi. | Chưa có E2E tạo sản phẩm với Catalog/Fulfillment thật; sản phẩm Draft cần nhập hàng riêng tại Quản lý kho. |
| Đấu giá cơ bản, đơn đấu giá | `/result` đọc trực tiếp contract v0.4 với `phase`, `settlement`, `myDeposit`, `secondChance`; không suy ra không có người thắng từ `winnerId` bị ẩn. Sửa cảnh báo quá hạn chỉ theo phase đang chờ thanh toán. | Màn kết quả cũ còn lớp trình bày tương thích; đơn đấu giá seller list chưa đi qua Gateway runtime (`/api/v1/auction-orders/seller`). Commerce chưa trừ cọc khi tính số tiền đơn. |
| Cọc và Second-Chance | Nối service đọc `/deposit-requirement`, `/deposits/me`, `/second-chance/me`; phòng đấu giá hiển thị điều kiện và chỉ cho gửi bid khi `canBid=true` từ BE. Chuyển nhận/từ chối sang `/second-chance/accept|decline`, đọc lại lời mời và gửi `acceptedPrice`. Có màn admin chính sách cọc GET/PUT với `If-Match`, màn staff/admin xem cọc, và màn tra cứu/điều chỉnh vi phạm đấu giá theo quyền. | Chưa mở CTA tạo cọc vì WalletService thiếu hold/capture/release; `createDeposit` đã có service nhưng không cho người dùng gọi khi BE chưa an toàn. Chưa có kiểm thử E2E cọc, phạt và second-chance. |
| P2-02 Review hai chiều | Buyer review đọc `subOrders[].items`, gửi review sản phẩm multipart tới Catalog (có tối đa 5 ảnh) và review seller tới UserService với contract đúng. Seller có form review buyer sau khi đơn hoàn tất. Chi tiết sản phẩm hiển thị điểm, danh sách review và phân trang. | Chưa có trạng thái “đã đánh giá” lấy từ BE trước khi gửi, sửa/xóa review sản phẩm còn vướng route Gateway. Chưa test với đơn hoàn tất thật. |
| P2-03 Ví seller, rút, Stripe | Form nạp qua `POST /wallets/topups/stripe`, idempotency key theo ý định, redirect HTTPS; trang kết quả tra `GET /wallets/topups/{id}` và chỉ báo thành công từ BE. Form rút gọi `POST /wallets/withdrawals`, kiểm số tiền/số dư và hiển thị mã yêu cầu Pending. | Phải cấu hình Stripe SuccessUrl/CancelUrl về FE HTTPS hợp lệ; chưa xác nhận cấu hình runtime và webhook. WalletService thiếu GET danh sách yêu cầu rút; staff queue chưa thể hoàn thiện. Direct checkout cho đơn thường còn phụ thuộc Commerce. |
| P2-05 Khiếu nại, cấm quyền, freeze | Mở form báo cáo người dùng, chỉ nhận ảnh, upload bằng chứng rồi gửi báo cáo; hiển thị lỗi từng bước. | Gateway runtime chưa có route `/api/v1/reports/files/upload`; báo cáo có ảnh chưa nghiệm thu. Quyền cấm/freeze/unfreeze ví theo tranh chấp cần API BE; FE không tự đổi trạng thái ví. |
| P2-06 Báo cáo và kiểm duyệt SP | Chi tiết sản phẩm có form báo cáo 1–5 ảnh và danh sách review; tạo hàng đợi staff/admin cho báo cáo sản phẩm với `BAN_PRODUCT`, `DISMISS`, `INVESTIGATE`; sửa action duyệt sản phẩm thường từ `SUSPENDED` sai sang `SUSPEND`. | Gateway runtime định tuyến `/api/v1/admin/reports/**` sang UserService, nên `/reports/products` chưa tới CatalogService. Chưa smoke test hàng đợi qua Gateway. |
| P2-07 GHN hoàn kho | Màn vận đơn seller đã đọc shipment theo order, hiển thị trạng thái và thông báo thao tác hoàn kho đang khóa. | **Chưa bật confirm-return**: Fulfillment `ConfirmReturnAsync` có thể cộng tồn lặp và kiểm quyền không phù hợp kho chung. Phải vá BE, xác nhận order/suborder ID và kiểm E2E trước khi mở nút. |

## File đã sửa/thêm

- Catalog/Seller: `src/features/seller/SellerScreens.tsx`, `SellerProductDetailScreen.tsx`, `SellerAuctionProductCreate.tsx`, `SellerBuyerReview.tsx`, `services/catalog.service.ts`; route `src/app/(dashboard)/seller/products/auction/new/page.tsx`.
- Auction: `src/features/auction/AuctionOperations.tsx`, `AuctionPages.tsx`, `BuyerAuctionOffers.tsx`, `AuctionResultExtras.tsx`, `AdminAuctionDeposits.tsx`, `AdminDepositPolicy.tsx`, `AdminAuctionViolations.tsx`, `services/auction.service.ts`, `types/index.ts`; các route admin/staff cọc, vi phạm và chính sách cọc.
- Wallet: `src/features/wallet/WalletOperationsScreens.tsx`, `WalletTopUpFlow.tsx`, `SellerWithdrawalForm.tsx`, `services/wallet.service.ts`, `types/index.ts`; route kết quả nạp và `/payments/success|cancel`.
- Review/report: `src/features/commerce/CommerceScreens.tsx`, `src/features/catalog/ProductDetailScreen.tsx`, `ProductFeedback.tsx`, `src/features/staff/StaffProductModerationScreen.tsx`, `StaffProductReportsScreen.tsx`; route staff/admin product reports.
- Điều hướng: `src/constants/routes.ts`.

## Hạng mục tạm hoãn theo quyết định

| Hạng mục | Trạng thái |
| --- | --- |
| P2-01 Voucher Sàn & Shop | Tạm hoãn, không triển khai trong đợt này. |
| P2-04 Sổ cái kép & Bill lệch | Tạm hoãn, không gọi các màn giao dịch hiện có là sổ cái kép. |
| P2-08 Config động, Audit Log, System Health | Tạm hoãn, **không** triển khai `/admin/audit-log`. |
| BE cọc đấu giá | Tạm hoãn: Wallet hold/capture/release và route thống nhất; Commerce bảo vệ settlement và khấu trừ cọc; Auction retry/capture; User reset vi phạm. |
| BE hoàn kho | Chưa bật FE mutation trước khi Fulfillment idempotent và kiểm quyền đúng. |

## Kiểm tra và giới hạn

- `npm run typecheck`: đạt.
- `npm run lint`: đạt, 5 warning hiện có ở `NexusLogo.tsx`, `lib/api/client.ts`, `tests/seller-flow.test.mjs`; không có error.
- `npm run test:session`: đạt 9/9; đây là test xác thực phiên, chưa bao phủ các luồng Phase 2 mới.
- `git diff --check`: đạt.
- `npm run build`: bị chặn bởi `getaddrinfo ENOTFOUND fonts.googleapis.com` khi `next/font` tải Plus Jakarta Sans; chưa xác nhận build production.
- Chưa có smoke test với Gateway/BE thật, Stripe webhook, tài khoản theo vai trò hoặc ảnh chụp desktop/mobile. Các mục phụ thuộc Gateway và BE phía trên **chưa được tính là hoàn thành**.

## Việc cần làm tiếp

1. Chốt và sửa Gateway runtime cho upload report ảnh, hàng đợi report sản phẩm, seller auction orders và review Catalog khi sửa/xóa.
2. Hoàn thiện BE Wallet hold và Commerce settlement; sau đó mở CTA tạo cọc với version/amount/idempotency và kiểm cả bid lẫn second-chance E2E.
3. Vá Fulfillment confirm-return chống cộng tồn lặp và quyền với kho chung, rồi mở CTA seller và tải lại tồn sau phản hồi.
4. Bổ sung GET yêu cầu rút và trạng thái freeze/unfreeze từ WalletService; hoàn thiện staff queue và màn tranh chấp.
5. Chạy build trong môi trường truy cập Google Fonts hoặc dùng font local đã được phê duyệt; smoke test toàn bộ route mới và responsive.
