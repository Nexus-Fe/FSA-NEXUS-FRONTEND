# Báo cáo Customer, API chưa nối và đề xuất tinh gọn giao diện

- Ngày rà soát: 30/10/2026
- Nhánh: `VU/UI-customer`
- Customer trong yêu cầu tương ứng với role `buyer` trong mã nguồn.
- Phạm vi: chỉ đọc FE và source BE lân cận; không sửa code, không thay đổi UI/UX.

## Kết luận nhanh

Customer hiện có 11 route nghiệp vụ và 5 route storefront công khai. Phần lớn luồng chính đã có giao diện và request tới Gateway, nhưng Catalog, Commerce, Auction chưa có API nghiệp vụ được expose từ service tương ứng. Vì vậy các trang nhìn thấy được chưa đồng nghĩa với việc mua hàng, đấu giá hay xem dữ liệu thật đang chạy.

Wallet có REST endpoints trong source BE và Gateway; tuy nhiên chưa xác minh runtime vì thiếu cấu hình kết nối bắt buộc và Docker Engine hiện không chạy. Các thao tác nạp tiền đang bị khóa trên FE dù endpoint đã có trong source.

## Customer: các API FE gọi và trạng thái

| Luồng Customer | FE gọi | Trạng thái đối chiếu source | Vấn đề / hướng xử lý |
| --- | --- | --- | --- |
| Danh sách sản phẩm, danh mục, chi tiết sản phẩm | `GET /api/v1/products`, `/api/v1/categories`, `/api/v1/product/{id}` | Gateway có route; `Catalog.Api` hiện chỉ map `/health`, chưa expose API nghiệp vụ. | **BE:** triển khai endpoint Catalog và đăng ký vào pipeline, hoặc xác nhận service/base path thay thế. **FE:** giữ loading/error thật; không coi route Gateway là bằng chứng API hoạt động. |
| Thêm vào giỏ | `POST /api/v1/cart/items` | Gateway có route; `Commerce.Api` chỉ map `/health`. | **BE:** triển khai API giỏ hàng trong Commerce. Nút thêm giỏ chỉ có thể nghiệm thu sau khi Gateway nhận phản hồi thật. |
| Xem/sửa/xóa giỏ hàng | `GET /api/v1/cart`, `PATCH /api/v1/cart/items/{id}`, `DELETE /api/v1/cart/items` | FE có request; Commerce chưa expose API nghiệp vụ. | **BE:** triển khai các thao tác cart và hợp đồng lỗi/giỏ rỗng. **FE:** xác nhận tổng tiền được lấy từ response backend, không suy ra thành công từ thao tác local. |
| Báo giá và tạo đơn | `POST /api/v1/checkout/quote`, `POST /api/v1/orders` | Gateway có route; Commerce chỉ có health. | **BE:** triển khai quote/create order cùng trạng thái thanh toán. Hiện chưa thể xác nhận checkout end-to-end. |
| Danh sách đơn mua | Không có request danh sách trong `OrdersScreen` | Màn hiện báo chưa có API danh sách và có ô tra cứu ID không hoạt động. | **BE:** bổ sung `GET` danh sách đơn theo người mua và phân trang. **FE:** bỏ ô tra cứu thủ công khi nó chưa mở được đơn. |
| Chi tiết đơn và vận đơn | `GET /api/v1/order/{id}`, `/api/v1/shipments/order/{id}` | Gateway có route; Commerce/Fulfillment hiện chưa expose API nghiệp vụ. | **BE:** triển khai chi tiết đơn ở Commerce, trạng thái vận chuyển ở Fulfillment; nối danh sách → chi tiết bằng ID thật. |
| Đấu giá công khai, giá thầu, kết quả | `/api/v1/auctions*`, `/api/v1/me/bids*` | Gateway có route; `Auction.Api` hiện chỉ map `/health`. | **BE:** triển khai API Auction trước khi nghiệm thu danh sách, phòng đấu giá, lịch sử giá thầu và kết quả. |
| Ví và lịch sử giao dịch | `GET /api/v1/wallets/me`, `GET /api/v1/wallets/transactions` | FE, Gateway và Wallet có endpoint tương ứng trong source. Runtime chưa xác minh. | **BE/vận hành:** cung cấp `CONNECTION_STRING`, khởi động Wallet và kiểm tra `Real/Enforce`. Sau đó mới xác nhận balance/history hoạt động. |
| Nạp tiền | `POST /api/v1/wallets/topups/vnpay` | Endpoint có ở Gateway và Wallet, nhưng form FE đang disabled với nội dung nói Wallet chưa có REST API. | **FE:** cập nhật nội dung trạng thái cho đúng; đề xuất ẩn form nhập liệu hoặc chỉ hiện một thông báo ngắn cho đến khi Wallet chạy thật. Không mở nút giao dịch trước khi kiểm tra response/IPN. |
| Báo cáo người dùng | `GET /api/v1/me/reports`, `POST /api/v1/users/reports` | Gateway có route, nhưng UserService hiện không có action báo cáo tương ứng. | **BE:** triển khai lưu/xem báo cáo và trạng thái xử lý. **FE:** tạm ẩn CTA gửi báo cáo và phần lịch sử rỗng; giữ route trong backlog Customer. |
| Đánh giá sản phẩm/người bán | FE gửi review sau khi đơn hoàn tất | Commerce/Catalog chưa có API nghiệp vụ được expose; chưa xác nhận downstream review contract. | **BE:** chốt service sở hữu review, điều kiện đơn hoàn tất, chống gửi lặp và response. **FE:** chỉ giữ CTA sau khi backend xác nhận đơn đã hoàn tất và review endpoint sẵn sàng. |
| Hồ sơ, uy tín, vi phạm | `GET/PATCH /api/v1/me`; thêm `GET /api/v1/me/reputation`, `/api/v1/me/penalties` | UserService có profile GET/PATCH; chưa có hai endpoint reputation/penalties trong controller hiện tại. | **BE:** bổ sung hai API hoặc xác nhận không thuộc phạm vi hiện tại. **FE:** chỉ ẩn các khối uy tín/vi phạm chưa có dữ liệu; giữ phần hồ sơ cá nhân đang có contract. |

## Customer: luồng tài khoản

- Login, register, verify OTP, forgot password, reset password có route ở Gateway/UserService và request chính từ FE tương ứng. Chưa kiểm tra runtime vì Docker Engine đang dừng.
- Nút gửi lại OTP ở trang quên mật khẩu gửi `type: FORGOT_PASSWORD`, nhưng UserService hiện xử lý endpoint resend như OTP đăng ký. Tài khoản đã active có thể bị từ chối gửi lại, và OTP mới không mang purpose đặt lại mật khẩu.
  - **BE cần làm:** endpoint/DTO resend theo purpose, tạo OTP `password_reset` và giữ cơ chế chống lộ email.
  - **FE sau khi BE có contract:** gọi đúng endpoint/purpose.
- NotificationService chưa có file `.env` runtime; compose để trống tài khoản SMTP nếu không cấp cấu hình. Mail sender hiện có chế độ mô phỏng trả thành công khi thiếu credentials. Vì vậy response thành công chưa chứng minh email/OTP thực sự đến hộp thư.
- `NotificationService/.env.example` có giá trị SMTP trông như credential thật. Đề nghị BE thay bằng placeholder và xoay credential nếu giá trị đó còn dùng được. Báo cáo này không ghi lại giá trị.

## Lỗi FE logic ảnh hưởng chuyển role

- `Shells.tsx` chỉ đối chiếu role đúng chuỗi `admin`, `staff`, `seller`; UserService có role name `Administrator` và `Support Staff`, được chuyển thành `administrator` và `support staff`. Hai role này không khớp nên nút dashboard Admin/Staff có thể không hiện.
- `RoleGate.tsx` đang comment phần so role; hiện chỉ chặn khi chưa đăng nhập, chưa chặn người đăng nhập sai role ở giao diện. Gateway vẫn phải là nơi bảo vệ API.
- Proxy FE đang comment kiểm tra header mode/auth từ Gateway nhưng tự gắn `Real` và `Enforce` vào response. Vì vậy phản hồi từ Gateway chưa được xác thực mode có thể bị FE hiểu nhầm là backend thật.

## Đề xuất tinh gọn giao diện theo role

Đây là đề xuất dựa trên menu, route và trạng thái API trong source; chưa có ảnh render/browser để kết luận về khoảng cách, mật độ hoặc màu sắc. Không đề xuất xóa các luồng nghiệp vụ khỏi phạm vi sản phẩm.

### Customer / Buyer

1. **Khách chưa đăng nhập:** chỉ để các mục storefront công khai như Trang chủ, Sản phẩm, Đấu giá trực tiếp. Chuyển “Đấu giá của tôi”, Ví, Báo cáo vào khu tài khoản sau đăng nhập.
2. **Buyer đã đăng nhập:** giữ “Đấu giá trực tiếp” và “Đấu giá của tôi” vì đây là hai việc khác nhau; không xóa chỉ để giảm số menu.
3. Tạm ẩn mục “Báo cáo” khỏi điều hướng cho tới khi UserService có API tạo/xem báo cáo. Giữ workflow trong backlog.
4. Ở Đơn mua, bỏ ô nhập UUID thủ công đang không mở được đơn; thay bằng trạng thái gọn chờ API danh sách đơn.
5. Ở Nạp tiền, không chiếm chỗ bằng form disabled. Chỉ hiện một trạng thái ngắn đến khi Wallet runtime được xác nhận.
6. Ở Hồ sơ cá nhân, giữ thông tin profile; tạm ẩn khối Uy tín/Vi phạm nếu API chưa có.
7. Không xóa cart/checkout/đấu giá khỏi sản phẩm; chỉ khóa CTA ghi dữ liệu khi API chưa sẵn sàng.

### Seller

- Tạm ẩn hoặc gom “Đơn bán” (hiện chỉ tra ID thủ công), “Vận chuyển” (Fulfillment chưa có endpoint), “Hồ sơ gian hàng” (UserService chưa có profile API) và form ví/rút tiền khi backend/runtime chưa sẵn sàng.
- Giữ các luồng Sản phẩm, Kho, Đấu giá trong phạm vi Seller; chỉ bật thao tác ghi sau khi Catalog/Auction có API thật.

### Staff

- Tạm gom/ẩn hàng đợi Báo cáo, Yêu cầu rút, Kiểm duyệt sản phẩm, Sai lệch giao dịch và Vận hành đấu giá cho đến khi có API danh sách tương ứng.
- Duyệt hồ sơ Seller có list/approve/reject ở UserService; trang chi tiết đang gọi GET chưa có. Có thể giữ mục này sau khi BE bổ sung detail API.

### Admin

- Giữ Quản lý tài khoản, Audit Log và Tình trạng hệ thống sau khi xác nhận runtime.
- Tạm ẩn/gom Quản lý đấu giá, Cấu hình đấu giá, RBAC, Danh mục, Sổ giao dịch, Cấu hình hệ thống, Mã giảm giá khi API service còn thiếu. Không xóa khỏi kế hoạch sản phẩm.

## Trạng thái kiểm chứng

- Source FE đang ở nhánh `VU/UI-customer`.
- Lượt này chỉ cập nhật báo cáo; không sửa code FE/BE và không chạy request ghi dữ liệu.
- Kiểm tra trước đó trên cùng source: `npm run lint` có 0 lỗi, 3 cảnh báo; `npm run typecheck` đạt.
- Docker Engine hiện không chạy; các kết luận BE là đối chiếu source/API contract, chưa phải xác nhận runtime.
- Các thay đổi chưa commit do cài skill trước đó vẫn được giữ nguyên.
