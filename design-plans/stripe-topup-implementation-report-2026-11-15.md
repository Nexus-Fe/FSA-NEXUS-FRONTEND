# Báo cáo triển khai luồng nạp ví Stripe — 15/11/2026

## Đã thực hiện

- Buyer nhập số tiền nguyên 10.000–99.999.999 ₫, xác nhận trong hộp thoại rồi mở Stripe Checkout. Nút gửi bị khóa khi tạo phiên; lần thử lại cùng yêu cầu dùng lại `Idempotency-Key`. Có thao tác bắt đầu lượt nạp mới sau khi kiểm tra xung đột.
- Cho phép nhiều lượt nạp `Pending` đồng thời. Trang Ví hiển thị các lượt đang chờ gần nhất, tách khỏi lịch sử giao dịch đã ghi sổ. Thêm danh sách phân trang `/buyer/wallet/top-ups` và chi tiết `/buyer/wallet/top-ups/[id]`.
- URL Stripe quay về mang `kind=topup` và `transactionId` của chính lượt nạp. Màn kết quả chỉ dùng mã này để truy vấn WalletService; đường quay về hoặc `checkout=cancel` không tự xác nhận thành công/thất bại. Các URL `/payments/success` và `/payments/cancel` cũ dẫn về màn kết quả thống nhất.
- Trang kết quả tự kiểm tra lại tối đa tám lần khi còn `Pending`, có nút kiểm tra thủ công, thông báo lỗi tra cứu, số dư chỉ tải khi backend trả `Success`, hộp thoại khi rời trang và nút tiếp tục phiên Stripe cũ khi còn hiệu lực.
- Khi cần đăng nhập lại, đường dẫn giao dịch được mang theo `returnTo` và kiểm tra là đường dẫn nội bộ hợp quyền sau đăng nhập.
- WalletService thêm `GET /api/v1/wallets/topups`, `POST /api/v1/wallets/topups/{transactionId}/resume`, mở rộng `GET /api/v1/wallets/topups/{id}` với `canResume` và `sessionExpiresAt`. Truy vấn đều giới hạn theo người dùng hiện tại; resume kiểm tra trạng thái và đối chiếu phiên Stripe, không tạo Checkout Session mới.
- WalletService chạy tác vụ đối soát mỗi phút cho top-up `Pending` có phiên Stripe. Tác vụ dùng cùng `StripeSettlement` với webhook để ghi có một lần và chuyển trạng thái khi phiên hết hạn. Gateway đã có route `/api/v1/wallets/{**catch-all}`; biến đổi hiện có không sửa body hoặc `Stripe-Signature`.

## Tệp đã thay đổi

**Frontend (`nexus-dev-fe`):**

- `src/features/wallet/WalletTopUpFlow.tsx`, `WalletTopUpHistory.tsx`, `WalletScreen.tsx`, `types/index.ts`, `services/wallet.service.ts`
- `src/app/(dashboard)/buyer/wallet/top-ups/page.tsx`, `top-ups/[id]/page.tsx`, `top-up/result/page.tsx`, `buyer/payment/result/page.tsx`
- `src/app/(public)/payments/success/page.tsx`, `payments/cancel/page.tsx`
- `src/components/auth/RoleGate.tsx`, `src/features/auth/AuthScreens.tsx`, `src/constants/routes.ts`, `src/styles/globals.css`

**WalletService (`nexus-dev-be/WalletService`):**

- `Wallet.Api/Controllers/Public/WalletsController.cs`, `Program.cs`, `StripeTopupReconciliationWorker.cs`
- `Wallet.Application/Features/Topups/Queries/ListTopups/*`, `Commands/ResumeTopup/*`, `Queries/GetTopupStatus/*`
- `Wallet.Application/Features/Stripe/Commands/ReconcilePendingTopups/*`, `StripeTopupPreparation.cs`, `Interfaces/IStripeCheckoutClient.cs`
- `Wallet.Infrastructure/Payments/StripeCheckoutClient.cs`, `Wallet.Tests/StripeCheckoutClientTests.cs`

Các thay đổi seller/catalog/staff và tệp Excel có sẵn trong working tree đã được giữ nguyên.

## Kiểm tra

- FE: `npm run lint` đạt (5 cảnh báo có sẵn), `npm run typecheck` đạt, `npm run build` đạt; route mới xuất hiện trong danh sách build.
- BE: `dotnet test Wallet.sln -c Release --no-restore` đạt **339**, bỏ qua **9** test tích hợp PostgreSQL do môi trường test hiện tại. Test mới xác nhận cả hai URL quay về có đúng `transactionId`.
- `git diff --check` không phát hiện lỗi khoảng trắng.
- Đã dựng lại riêng container `nexus-wallet-service`; `GET http://localhost:8008/health` trả `Healthy`.
- Route FE mới `GET http://localhost:3000/buyer/wallet/top-ups` trả HTTP 200.

## Chưa nghiệm thu end-to-end

- Cần chạy Stripe test mode với webhook được chuyển tới WalletService/Gateway trong môi trường thử nghiệm, rồi kiểm tra: thanh toán thành công sau khi đóng tab, callback chậm, webhook lặp, phiên hết hạn, người khác mở URL giao dịch và hai lượt nạp cùng số tiền. Localhost cần Stripe CLI hoặc endpoint HTTPS chuyển tiếp webhook; Stripe không gọi trực tiếp localhost của máy người dùng.
- Các test PostgreSQL đang bị bỏ qua; cần chạy với database test để xác minh khóa giao dịch và đối soát cạnh tranh cùng webhook.
- Chưa xác minh trực quan trên trình duyệt ở desktop/mobile với tài khoản thật. Đã kiểm tra biên dịch và bố cục CSS responsive.
- Lượt nạp kẹt ở giai đoạn tạo phiên trước khi lưu `CheckoutSessionId` chưa có dữ liệu phiên để đối soát tự động; cần cơ chế vận hành riêng nếu lỗi mạng/DB xảy ra đúng thời điểm đó.
