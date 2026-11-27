# Note Ngữ cảnh: Voucher Checkout, Giỏ hàng & Tái cấu trúc Đơn mua/SubOrder kiểu Shopee (FE)

> **Lưu tại:** `.agents/notes/2026-11-28_0315-checkout-voucher-va-suborder-shopee-ux.md`
> **Tham chiếu Design System:** `DESIGN.md`

- **Thời gian lập:** 2026-11-28, 03:15 (UTC+7)
- **Cập nhật lần cuối:** 2026-11-28, 03:15 (UTC+7)

---

## 1. Bối cảnh & Toàn bộ Yêu cầu của Người dùng
1. **Voucher ở Checkout (`CheckoutVoucherPanel.tsx` & `BuyerCommerceScreens.tsx`):**
   - Bỏ các dòng note giải thích kiểu `"Trừ trước theo sản phẩm"`, `"Trừ sau sản phẩm (chỉ chọn 1 mã SP hoặc Shop)"`, `"Trừ cuối cùng trên phần còn lại"`. Chỉ cần chọn 1 mã thì mã xung đột sẽ mờ đi (`disabled`) và không chọn được.
   - Chặn cứng khi mã được chọn không hợp lệ / không đủ điều kiện đa tầng (`Product -> Shop -> System`) và **khóa nút thanh toán / đặt hàng** nếu có voucher bị từ chối hoặc báo lỗi từ BE, nhả lỗi rõ ràng để người dùng chọn mã khác.
   - Nút **"Chọn mã tốt nhất"** không chọn các mã không sử dụng được (hết lượt / chưa đủ điều kiện / COD không dùng mã sàn) và phải tính toán chọn tối ưu cho cả 3 loại (`Product` vs `Shop` tốt nhất của từng shop + `System` tốt nhất trên phần còn lại).
   - Khi đã xác nhận địa chỉ ở Checkout (`!editingShipping`): tích/bỏ tích voucher hoặc check giá lại **không được bung lại form nhập địa chỉ**, giữ nguyên địa chỉ và phí ship, đồng thời phần check giá lại vẫn hiện đầy đủ các dòng giảm giá và tổng gốc gạch ngang + tổng mới.
   - Khi đã đặt hàng được rồi (`OrderDetailScreen` / đơn đã tạo), **bỏ nút đổi địa chỉ đặt hàng** (`ChangeAddressButton`).
2. **Giỏ hàng (`CartScreen` & `cart-selection.ts`):**
   - Khi thêm 1 sản phẩm vào giỏ hàng (hoặc lần đầu thấy món mới trong giỏ), **sản phẩm đó mặc định CHƯA được chọn**.
3. **Chi tiết Đơn mua & SubOrder kiểu Shopee (`/buyer/orders/[id]` & trang chi tiết SubOrder):**
   - **Trên màn hình chi tiết Order (`/buyer/orders/[id]`):**
     - Có **thanh tiến trình kiểu Shopee** gồm các trạng thái (`Đã đặt hàng / Chờ thanh toán`, `Đã thanh toán`, `Chờ lấy hàng`, `Đang giao hàng`, `Đã giao / Hoàn tất`, `Đã hủy / Hoàn tiền`), **từng mục trạng thái ấn vào được**, mỗi `SubOrder` ở trạng thái nào sẽ nằm trong ô trạng thái đó (tách biệt tiến độ giao hàng giữa các shop).
     - Trong mỗi mục trạng thái hiển thị danh sách **card `SubOrder`**:
       - Tiêu đề là **tên Shop** + **badge trạng thái** kế bên.
       - Hiển thị **1 món hàng đầu tiên** của shop đó (ảnh, tên sản phẩm, số lượng, giá).
       - Có nút/thao tác ấn vào để điều hướng sang **trang chi tiết `SubOrder`** (xem đầy đủ sản phẩm của shop đó).
     - Hiển thị đầy đủ detail giảm giá (ghi rõ giảm theo loại gì + mã nào), tổng tiền gồm ship lúc chưa giảm (gạch ngang) và tổng cuối cùng.
     - Phần thông tin đơn: **không ghi Mã Buyer / thông tin người đặt**, tách thông tin giao và thời gian tạo đơn gọn gàng sang khu vực phù hợp.
   - **Trang Chi tiết `SubOrder` (`/buyer/orders/[id]/sub-orders/[subOrderId]` hoặc `/buyer/orders/by-sub/[id]`):**
     - **Bố cục 2 cột (2/3 trái + 1/3 phải):**
       - **Cột trái (2/3):**
         - **Card trên (Thông tin nhận hàng):** chỉ hiển thị gọn **tên shop + địa chỉ nhận hàng**, **không hiện địa chỉ gửi hàng của shop**; ấn vào mở **Popup chi tiết** (tên shop, tên người nhận, SĐT, địa chỉ giao hàng, thời gian tạo đơn, phương thức thanh toán).
         - **Card dưới (Sản phẩm & Thanh toán):** liệt kê toàn bộ sản phẩm trong `SubOrder` kèm **số lượng kế bên**, **giá record lúc mua hàng** (có giá gốc gạch ngang + giá sau giảm sản phẩm nếu có). Ấn vào từng sản phẩm mở **Popup thông tin cơ bản của sản phẩm** kèm **nút nhỏ ở góc trên bên phải** để điều hướng sang `/catalog/{productId}`. Phía dưới có **nút dropdown xổ xuống kiểu Shopee** hiển thị chi tiết đã giảm những gì, bao nhiêu, tổng ban đầu (tiền hàng + ship lúc chưa giảm), và tổng thanh toán cuối.
       - **Cột phải (1/3):**
         - **Card Thông tin giao hàng:** mã đơn con (`subOrderNo`), mã vận đơn (nếu có), trạng thái chuẩn bị/giao hàng của người bán (đang chờ xác nhận / đang chuẩn bị hàng / đang giao...), thông tin đơn giao, và nút **xem hành trình đơn hàng** (hiển thị cả mốc chờ seller xác nhận nếu chưa xác nhận, hoặc giữ nguyên record cũ chưa xác nhận + mốc đã xác nhận nếu seller đã xác nhận).

---

## 2. Kết quả Kiểm tra Frontend & API Hiện có
1. **Cart selection (`src/features/commerce/cart-selection.ts`):**
   - Hiện `reconcileCartSelection` đang auto-select tất cả item ở lần đầu (`selectedIds: [...current]`) và auto-select mọi item mới (`if (!prevKnown.has(id)) nextSelected.push(id)`). Cần đổi thành mặc định `[]` cho item mới.
2. **Checkout (`BuyerCommerceScreens.tsx` & `CheckoutVoucherPanel.tsx`):**
   - `CheckoutVoucherPanel` đang có `hint` text trong group header -> cần bỏ theo yêu cầu.
   - `CheckoutScreen` kiểm tra `{(!quoteReady || editingShipping)}` để ẩn/hiện form địa chỉ -> khiến bấm/bỏ tích voucher làm bung lại form địa chỉ và mất phí ship -> cần tách `shippingConfirmed` và `lastShippingQuote`.
   - `CheckoutScreen` chưa khóa nút đặt hàng khi `activeQuote.rejectedVouchers?.length > 0`.
3. **Orders & SubOrders (`BuyerCommerceScreens.tsx`, `OrderBySubOrderScreen.tsx`, `OrderShipmentsCard.tsx`):**
   - Đã có API `GET /api/v1/orders/{orderId}` (trả đầy đủ `subOrders`, `items`, `appliedVouchers`, `productDiscountAmount`, `shopDiscountAmount`, `systemDiscountAmount`, `shippingFeeAmount`, `totalAmount`).
   - Đã có API `GET /api/v1/sub-orders/{subOrderId}` (trả `SubOrderDetailResponse` với đầy đủ `items`, giảm giá, địa chỉ, trạng thái).
   - Đã có API `GET /api/v1/sub-orders/{subOrderId}/shipments/timeline` và `GET /api/v1/shipments/tracking/{code}` và `GET /api/v1/products/{productId}` và `GET /api/v1/sellers/{sellerId}`.
   - `OrderDetailScreen` hiện đang render mỗi `SubOrder` thành một card dài nối tiếp + có `ChangeAddressButton` + hiển thị `Mã Buyer` ở card Thông tin đơn + không có thanh tiến trình lọc từng trạng thái có thể ấn + chưa có trang chi tiết `SubOrder` bố cục 2/3 - 1/3 + chưa có popup sản phẩm khi bấm vào sản phẩm + chưa có dropdown chi tiết giảm giá kiểu Shopee.

---

## 3. Lưu ý cho các Subagent Khi Triển khai
- Giữ tương thích ngược cho `ROUTES.buyer.orderBySubOrder(id)` (hoặc cho `/buyer/orders/by-sub/[id]` mở thẳng trang Chi tiết `SubOrder` khi notification trỏ vào `subOrderId`!).
- Popup sản phẩm cơ bản trên màn đơn mua lấy dữ liệu qua `GET /api/v1/products/{productId}` (kèm fallback hiển thị thông tin snapshot từ đơn hàng nếu sản phẩm đã bị ẩn/gỡ).
- Popup chi tiết người nhận tại trang `SubOrder` tuyệt đối không hiển thị `pickupAddress` / địa chỉ kho gửi hàng của shop.
- Mọi tên shop ưu tiên lấy `shopName` từ BE (nếu dạng fallback `Shop xxxxxxxx` thì có thể tra cứu thêm từ `GET /api/v1/sellers/{sellerId}`).
- Tuân thủ token màu, `card` (`20px` radius), `Modal`, `TruncatedText` trong `DESIGN.md`.
