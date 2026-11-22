# Kế hoạch cập nhật toàn bộ giao diện Nexus

**Ngày:** 22/11/2026
**Nhánh triển khai hiện tại:** `feature/buyer-home-glass-ui`
**Phạm vi:** UI/UX của FE; giữ nguyên nội dung nghiệp vụ, đường dẫn, quyền truy cập, hành vi nút bấm, dữ liệu và API.

## 1. Hướng thiết kế đã chốt

- Lấy cảm hứng từ video tham khảo: lớp kính trong mờ, ánh sáng mềm, chiều sâu, chuyển động xuất hiện nhẹ, hover nổi và chuyển cảnh mượt. Không sao chép nội dung hoặc cấu trúc dashboard trong video vào Nexus.
- Bảng màu chính: `#051F20` (nền tối), `#0B2B26`, `#163832`, `#235347` (màu tương tác), `#8EB69B` (điểm nhấn), `#DAF1DE` (nền sáng).
- Quản lý màu tại `src/styles/theme.css`; component dùng biến màu thay vì tự ghi mã hex. Giữ màu đỏ, vàng và xanh trạng thái khi chúng biểu thị lỗi, cảnh báo, thành công hoặc dòng tiền.
- Glass dùng trên header, card, form hoặc khối giới thiệu có chọn lọc: nền bán trong suốt, blur, viền sáng và bóng nhẹ. Nội dung và nút phải đủ tương phản khi có ảnh hoặc nền tối phía sau.
- Chuyển động chỉ dùng `transform` và `opacity` cho hiệu ứng xuất hiện/hover; hỗ trợ `prefers-reduced-motion`. Không thêm chuyển động làm chậm thao tác mua hàng hoặc quản trị.
- Desktop, tablet và mobile phải giữ đủ hành động chính, không tràn ngang, không che form, bảng hoặc popup.

## 2. Tình trạng hiện tại

| Nhóm | Đã cập nhật trên nhánh hiện tại | Còn cần làm |
| --- | --- | --- |
| Màu toàn cục | Đổi các token chính trong `theme.css` sang bảng màu mới. `feature/color-general` đã nằm trong `dev`. | Rà các màu xanh cũ đang ghi trực tiếp trong CSS/component; chuyển về token thích hợp. Kiểm tra logo bitmap xanh hiện tại và chốt phương án đổi màu nếu cần. |
| Public và Buyer | Đã áp màu, navbar kính mờ, nền, card, form và trạng thái chính cho Home, catalog, gian hàng, đấu giá, giỏ, checkout, đơn, ví, thông báo và đăng nhập/đăng ký. Đã xem trực tiếp các màn đại diện ở desktop, giỏ và đăng nhập ở mobile; typecheck và production build đạt. | Cần kiểm thử nghiệp vụ và toàn bộ trạng thái dữ liệu thực tế riêng; lỗi API không nằm trong đợt đổi UI. |
| Seller, Staff, Admin | Chưa chuyển đồng bộ sang giao diện mới. | Thực hiện theo mục 3. |

## 3. Checklist theo nhóm trang

### A. Vỏ trang và tài khoản dùng chung

- [ ] Header, tìm kiếm, navbar, breadcrumb, footer, menu tài khoản, chuông thông báo: áp token và kính mờ nhất quán; kiểm tra sticky khi cuộn trên nền ảnh sáng/tối.
- [ ] Sidebar Seller/Staff/Admin: màu active, hover, nhóm menu, trạng thái thu gọn và mobile drawer.
- [ ] Hệ component nền tảng: button, card, badge, input, select, textarea, bảng, phân trang, tab, modal, toast, loading, empty/error state. Giữ màu ngữ nghĩa cho cảnh báo và trạng thái giao dịch.
- [ ] `/login`, `/register`, `/account/forgot-password`, `/account/reset-password`, `/account/change-password`, `/account/profile`: form, lỗi xác thực, OTP và responsive.

### B. Public và Buyer

- [ ] `/`: hoàn tất kiểm tra Home và trạng thái đăng nhập/khách; đây là trang mở đầu hiện có của FE, không thêm nội dung landing page mới khi chưa được chốt.
- [ ] `/catalog`, `/catalog/[id]`, `/shops/[id]`: bộ lọc sticky, thẻ sản phẩm, gallery ảnh, biến thể, thông tin gian hàng và phân trang.
- [ ] `/auctions`, `/auctions/[id]`: danh sách, phòng đấu giá, trạng thái phiên, đồng hồ, đặt giá, tiền cọc và thông báo kết quả.
- [ ] `/buyer/auctions/[id]/result`, `/buyer/auctions/[id]/payment`: nối tiếp phong cách của trang Đấu giá của tôi; làm rõ trạng thái thắng/thua và bước thanh toán.
- [ ] `/buyer/cart`, `/buyer/checkout`, `/buyer/payment/result`, `/payments/success`, `/payments/cancel`: ưu tiên độ rõ của giá, phí, voucher, tổng tiền, lỗi thanh toán và CTA.
- [ ] `/buyer/orders`, `/buyer/orders/[id]`, `/buyer/orders/by-sub/[id]`, `/buyer/orders/[id]/review`: trạng thái đơn, xác nhận nhận hàng, hoàn tiền và form đánh giá.
- [ ] `/buyer/wallet`, `/buyer/wallet/top-up`, `/buyer/wallet/top-ups`, `/buyer/wallet/top-ups/[id]`, `/buyer/wallet/top-up/result`: số dư, lịch sử cộng/trừ, trạng thái Stripe và thông báo lỗi.
- [ ] `/buyer/notifications`, `/buyer/reports`: danh sách, lọc, chi tiết và trạng thái chưa đọc.
- [ ] `/buyer/become-seller`, `/buyer/reputation`, `/buyer/auctions`: hoàn tất các trường hợp dữ liệu thật, popup, danh sách dài và mobile.

### C. Seller

- [ ] `/seller/products`, `/seller/products/new`, `/seller/products/[id]`, `/seller/products/[id]/edit`, `/seller/products/auction/new`: bảng giá không xuống dòng, ảnh, biến thể/SKU, form tạo và sửa.
- [ ] `/seller/shop`, `/seller/inventory`: hồ sơ shop, địa chỉ lấy hàng, kho và số dư tồn.
- [ ] `/seller/orders`, `/seller/orders/[id]`, `/seller/shipments`, `/seller/shipments/[id]`: trạng thái xử lý, từ chối, vận chuyển và thao tác chính.
- [ ] `/seller/auctions` và các trang tạo/chi tiết/sửa/tạo lại/kết quả, `/seller/auction-orders`: form phiên, trạng thái, kết quả và đơn đấu giá.
- [ ] `/seller/wallet`, `/seller/withdrawals`: doanh thu, số dư, lịch sử và trạng thái rút tiền.
- [ ] `/seller/coupons`, `/seller/reviews`, `/seller/notifications`: form voucher, đánh giá Buyer và thông báo.

### D. Staff

- [ ] `/staff/sellers` và chi tiết: danh sách hồ sơ, duyệt/từ chối, lý do và lịch sử.
- [ ] `/staff/product-moderation`, `/staff/product-reports`, `/staff/reports`: bảng kiểm duyệt, bằng chứng, bộ lọc, popup quyết định.
- [ ] `/staff/auctions` và chi tiết/tiền cọc, `/staff/users/[id]/auction-violations`, `/staff/penalties`: trạng thái phiên, vi phạm và xử lý.
- [ ] `/staff/withdrawals`: hàng chờ, chi tiết và trạng thái rút tiền.
- [ ] `/staff/transactions/discrepancies`: giữ trạng thái ẩn theo phạm vi demo đã chốt; chỉ thiết kế khi nghiệp vụ được bật lại.

### E. Admin

- [ ] `/admin/overview`, `/admin/users` và chi tiết vi phạm: dashboard, bảng tài khoản, popup quản lý vai trò/hồ sơ/điểm uy tín.
- [ ] `/admin/categories`, `/admin/coupons`, `/admin/configs`: cây danh mục, form, bảng, xác nhận xóa và trạng thái lỗi.
- [ ] `/admin/auctions` và chi tiết/tiền cọc, `/admin/auction-configs`, `/admin/auction-configs/deposit-policy`, `/admin/auction-settlements`: cấu hình, giám sát và đối soát.
- [ ] `/admin/ledger`, `/admin/notifications`, `/admin/penalties`, `/admin/product-reports`, `/admin/reports`: bảng dữ liệu, lọc, tổng tiền, thao tác nhạy cảm và lịch sử.
- [ ] `/admin/roles`: giữ điều hướng cũ về Quản lý tài khoản; không tạo lại mục sidebar riêng.

## 4. Thứ tự triển khai đề xuất

1. **Nền tảng chung:** chốt token, khoảng cách, blur, độ tương phản và component UI dùng chung. Với component/trang gần giống nhau, hỏi bạn trước khi tách để tái sử dụng; không đổi tên hàm/component sẵn có nếu chưa được duyệt.
2. **Public + Buyer:** hoàn tất các màn còn lại theo luồng xem hàng → giỏ → thanh toán → đơn → đánh giá; đồng thời kiểm tra đấu giá và ví.
3. **Seller:** sản phẩm → kho → đơn/vận chuyển → doanh thu/ví → đấu giá, voucher và đánh giá.
4. **Staff và Admin:** ưu tiên màn có bảng, form và quyết định nghiệp vụ; giữ rõ trạng thái nguy hiểm, lỗi và xác nhận.
5. **Rà cuối:** desktop, tablet, mobile; trạng thái loading/rỗng/lỗi; bàn phím, focus, tương phản, reduced motion và hiệu năng blur.

## 5. Tiêu chí hoàn thành mỗi trang

- Nội dung, quyền, route, API request/response và hành vi nghiệp vụ không đổi.
- Các trạng thái loading, thành công, rỗng, lỗi và disabled đều có giao diện nhất quán.
- Không tràn ngang ở 390px; bảng dài vẫn đọc và thao tác được; modal/form không bị header hoặc sidebar che.
- Chữ dễ đọc trên nền kính, ảnh và gradient; nút có focus rõ; chuyển động tắt theo tùy chọn hệ điều hành.
- Kiểm tra trực tiếp trên web với dữ liệu thật nếu Gateway sẵn sàng, chạy typecheck/build, rồi gửi URL để bạn xem trước khi commit/push.

**Trạng thái tài liệu:** Đợt giao diện Public và Buyer đã hoàn tất ở mức theme và màn hình chính trên `feature/buyer-home-glass-ui`; các ô chưa đánh dấu vẫn là kiểm thử chi tiết và phần việc Seller/Staff/Admin. Thay đổi vẫn chưa commit/push.
