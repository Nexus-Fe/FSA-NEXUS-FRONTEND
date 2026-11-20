# Báo cáo Admin: đối chiếu API và đề xuất tinh gọn giao diện

- Ngày rà soát: 30/10/2026
- Nhánh FE: `VU/UI-customer`
- Phạm vi: đọc source FE, API Gateway và backend trong `C:\Users\vuleh\Documents\HieuLaptop\fsa-nexus-be`; không sửa code, không đổi UI/UX.
- Các kết luận dưới đây là đối chiếu source, chưa xác nhận runtime. Docker Engine chưa chạy trong lần kiểm tra trước.

## Kết luận

Admin có 12 route (gồm danh sách và chi tiết đấu giá), cùng 11 mục điều hướng. Màn hình đã được dựng, nhưng phần lớn chưa thể coi là nghiệp vụ hoạt động: một số request FE lệch route Gateway; một số route Gateway forward tới API chưa tồn tại trong service; một số màn chưa gọi API dù Gateway có endpoint.

Các màn có thể giữ làm việc trước mắt sau khi xử lý hợp đồng là **Quản lý tài khoản**, **Audit Log** và **Tình trạng hệ thống**. Chúng cũng chưa được xác nhận chạy end-to-end. Những màn còn lại nên gom/ẩn tạm khỏi menu theo đề xuất bên dưới; không loại khỏi phạm vi sản phẩm.

## Đối chiếu từng màn và hợp đồng API

| Màn Admin | FE hiện gọi | Đối chiếu Gateway và service | Vấn đề / hướng xử lý |
| --- | --- | --- | --- |
| Tổng quan | Không gọi API; chỉ có các thẻ điều hướng | FE ghi rõ chưa có API tổng hợp KPI. 8 thẻ đang lặp lại các mục sidebar. | **FE đề xuất:** giữ trang gọn với trạng thái và lối tắt cần thiết; bỏ lưới thẻ trùng menu. Chỉ thêm số liệu khi BE chốt API tổng hợp. |
| Quản lý tài khoản | `GET /api/v1/admin/users...`; chi tiết `GET /api/v1/admin/user/{id}` | Gateway định nghĩa list ở `GET /api/v1/admin/user` (số ít), nhưng forward xuống UserService `/api/v1/admin/users`. Gateway có detail `/api/v1/admin/user/{id}`. | **FE:** list đang gọi sai route Gateway (plural). Sửa path theo route Gateway sau khi được duyệt. **BE:** UserService có list/detail source; cần xác nhận Gateway Enforce/Real và quyền Staff/Admin trước khi nghiệm thu. FE hiện chưa có thao tác tạo/cập nhật/khóa tài khoản dù Gateway khai báo một số endpoint ghi. |
| Phân quyền RBAC | GET `/api/v1/admin/roles`, GET `/api/v1/admin/permissions`, PUT `/api/v1/admin/roles/{id}/permissions` | Gateway có đủ route và chuyển tiếp tới UserService. Trong UserService không tìm thấy controller/action cho roles, permissions hoặc gán permissions; AdminUsersController hiện chỉ có CRUD tài khoản. | **BE:** triển khai API roles/permissions trong UserService hoặc trỏ Gateway tới service sở hữu RBAC; chốt DTO và quyền. **FE:** chưa thể tải/lưu quyền thật; tạm gom/ẩn mục cho tới khi có downstream contract. |
| Quản lý đấu giá + chi tiết | Trang route có sẵn; chưa thấy request API gắn với màn Admin trong `AdminScreens.tsx` | Auction service hiện không có controller HTTP nghiệp vụ được expose; Gateway có một số route auction ở các controller khác nhưng không chứng minh Admin flow hoạt động. | **BE:** bổ sung/chốt API quản trị phiên đấu giá trong Auction service và route Gateway tương ứng. **FE:** hiện là màn chưa nối API Admin; tạm ẩn/gom. |
| Cấu hình đấu giá | Chưa thấy request gắn với màn này | Chưa xác minh được hợp đồng cấu hình Admin ở downstream Auction. | **BE:** định nghĩa API đọc/ghi, validation, audit reason và quyền. **FE:** tạm ẩn cho tới khi có hợp đồng. |
| Danh mục | GET `/api/v1/categories` | Gateway có GET/POST/PUT/DELETE `/api/v1/categories` và forward tới Catalog. Catalog có domain/service cho Category nhưng không có HTTP controller tương ứng để expose route; `Catalog.Api` hiện chỉ map health. | **BE:** expose controller/endpoint Catalog, đăng ký DI và kiểm tra Gateway mapping. **FE:** GET hiện có thể lỗi ở downstream; màn chỉ đọc chưa thể được xem là đã nối thành công. |
| Sổ giao dịch | Không có endpoint FE (endpoint metadata là `null`) | Gateway có thao tác điều chỉnh ví Admin, nhưng không tìm thấy REST endpoint truy vấn ledger Admin. Wallet có lịch sử giao dịch cá nhân, không thay thế ledger/đối soát toàn hệ thống. | **BE:** bổ sung API ledger Admin có lọc, phân trang, trạng thái đối soát và phân quyền; không dùng API giao dịch cá nhân để làm sổ toàn sàn. **FE:** giữ ngoài menu tới lúc có API đọc. |
| Audit Log | GET `/api/v1/admin/audit-logs?page=...&limit=...&actorId=...&action=...&fromDate=...&toDate=...` | Gateway có route cùng query và forward tới UserService `/api/v1/admin/audit-logs`; UserService không có action này. LogService có `GET /api/v1/admin/logs` và `GET /api/v1/log/logs`. | **BE:** sửa Gateway để định tuyến tới LogService, thống nhất query/DTO và xác nhận dữ liệu nào là audit event. **FE:** tên route Gateway hiện khớp; cần đổi field mapping nếu DTO LogService khác. Màn chưa được coi là hoạt động cho tới khi downstream được nối. |
| Cấu hình hệ thống | GET `/api/v1/admin/configs` | Gateway có GET/PUT `/api/v1/admin/configs`, forward xuống UserService; UserService không tìm thấy controller/action configs. | **BE:** triển khai kho cấu hình và endpoint đọc/ghi (bao gồm key, value, reason, audit), hoặc đổi service đích. **FE:** hiện chỉ đọc và không có dữ liệu xác thực; tạm gom/ẩn. |
| Mã giảm giá | Không gọi API (`endpoint: null`) | Không tìm thấy hợp đồng coupon tương ứng ở Gateway/backend đã khảo sát. | **BE:** xác định service sở hữu coupon và CRUD/validation. **FE:** giữ trong backlog, tạm bỏ khỏi menu. |
| Tình trạng hệ thống | Không gọi API (`endpoint: null`) | Gateway có `/api/v1/gateway/prober/status`, `/status/{service}`, thao tác probe, DB status/check, nhưng controller yêu cầu `GatewayAdmin` và có lớp kiểm tra API key riêng (`X-Api-Key`, `X-CheckHeal-Key` hoặc bearer không phải JWT). CheckHealService cũng có health/database endpoints. | **BE/vận hành:** chốt cách cấp quyền an toàn cho Admin dashboard; không đưa API key bí mật vào browser. Có thể cung cấp endpoint Gateway phù hợp với JWT Admin/Staff hoặc BFF server-side. **FE:** màn hiện chưa nối API; không gọi thẳng prober từ client cho tới khi có hợp đồng xác thực an toàn. |

## Lệch nối API cụ thể

1. **Danh sách tài khoản:** FE plural `/api/v1/admin/users`; Gateway public route là singular `/api/v1/admin/user`. Downstream UserService lại dùng plural. Chọn một contract thống nhất và sửa FE hoặc Gateway; hiện hai lớp public/downstream khác nhau.
2. **RBAC, audit log, config:** Gateway đã khai báo route nhưng forward sang UserService action chưa có. Đây là thiếu backend service contract, không phải chỉ lỗi UI.
3. **Danh mục:** Gateway có proxy nhưng Catalog.Api chưa expose controller HTTP dù đã có Category domain/application service.
4. **System Health:** Gateway đã có prober API nhưng FE để endpoint `null`; API hiện được bảo vệ bằng GatewayAdmin/API key riêng, chưa có client contract an toàn cho dashboard.
5. **Ledger, coupon, auction admin/config:** chưa có API đọc/ghi phù hợp được xác nhận cho các màn này.

## Đề xuất tinh gọn menu Admin (không áp dụng code)

- **Giữ sau khi contract/runtime được xác nhận:** Quản lý tài khoản, Audit Log, Tình trạng hệ thống.
- **Tạm gom/ẩn khỏi menu vì thiếu downstream hoặc contract:** Phân quyền RBAC, Quản lý đấu giá, Cấu hình đấu giá, Danh mục, Sổ giao dịch, Cấu hình hệ thống, Mã giảm giá.
- **Tổng quan:** bỏ các thẻ lặp lại sidebar; giữ trang chào ngắn và chỉ hiển thị trạng thái thật từ API đã xác thực.
- Không xóa route hay nghiệp vụ khỏi kế hoạch; chỉ đề xuất giảm mục điều hướng cho tới khi BE sẵn sàng.

## Giới hạn xác minh

- Đọc source contract, không gửi request ghi dữ liệu.
- Docker Engine đang dừng theo kiểm tra trước đó; chưa xác nhận status code, auth, DTO thực tế hoặc kết nối database khi service chạy.
- Không thay đổi giao diện hay source code trong lượt audit này.
