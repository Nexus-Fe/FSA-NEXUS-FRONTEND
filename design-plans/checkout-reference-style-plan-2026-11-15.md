# Thiết kế checkout Nexus: Ví Nexus hoạt động, Stripe tạm vô hiệu hóa

Written against: FE commit `d936f4e`; rà thêm CommerceService và WalletService trong workspace ngày 15/11/2026. Phạm vi: `/buyer/checkout`, kết quả thanh toán đơn và phần hiển thị thanh toán trong chi tiết đơn. Phần FE của đợt hiện tại đã được triển khai ngày 15/11/2026; Stripe checkout vẫn vô hiệu hóa.

## Evidence chain

- **Ảnh tham khảo:** nền xám nhạt, hai thẻ trắng bo góc đặt cạnh nhau, tiến trình ở trên, phần nhập/địa chỉ bên trái, hàng hóa và tổng tiền bên phải. Nhịp dọc gọn; đường viền mảnh; điểm nhấn xanh chanh ở thông báo hoàn tất bước và nút thanh toán. Ô chọn có viền đậm khi được chọn. Tổng tiền nổi bật ngay trước nút trả tiền.
- **Nexus hiện tại:** `src/app/(dashboard)/buyer/checkout/page.tsx` tải `CheckoutScreen` từ `src/features/commerce/BuyerCommerceScreens.tsx`. `src/components/layout/Shells.tsx` đã cung cấp header và vùng `buyer-main`, vì vậy không thêm header thứ hai. `src/styles/globals.css` đã có `.checkout-layout`, `.checkout-main`, `.checkout-summary`, `.checkout-item`, trường nhập và các breakpoint.
- **Giới hạn dữ liệu:** `POST /api/v1/checkouts/quote` trả `quoteId`, `grandTotal`, `walletBalance`, `shops` (gồm phí vận chuyển và giảm giá), `expiredAt`. FE hiện gọi quote và lập tức gọi `POST /api/v1/orders` trong cùng thao tác; phần tóm tắt trước đó chỉ hiện giá hàng từ giỏ và “Phí vận chuyển: Theo báo giá”. Đơn được tạo với `paymentMethod: "Wallet"`.
- **Stripe trực tiếp đã có một phần BE:** `Commerce.Application/Services/Order/OrderService.cs` tạo đơn `PendingPayment`, gọi Wallet direct checkout khi `PaymentMethod.VnPay` và trả `paymentUrl` trong `CreateOrderResponse`. `Wallet.Application/Features/Checkout/Commands/CheckoutDirect` thực tế tạo Stripe Checkout; `GET /api/v1/wallets/checkout/direct/{orderId}` đọc trạng thái theo chủ giao dịch. Commerce worker thăm dò trạng thái để cập nhật đơn. FE hiện bỏ qua `paymentUrl`; `wallet.service.ts` còn định nghĩa sai payload direct checkout theo contract VNPay cũ.
- **Khoảng trống an toàn của luồng Stripe:** `PaymentMethod` của Commerce chỉ có `Wallet/VnPay/Cod`, nên tên phương thức trong đơn sẽ là `VnPay` dù trang trả tiền là Stripe. `StripeCheckoutClient` chỉ gắn `transactionId` vào URL quay về của top-up; direct order quay về `/buyer/payment/result` không có `orderId`, trong khi màn FE cần `orderId` để đọc đơn. Commerce hủy đơn chờ sau 15 phút; Checkout Session direct hiện không được đặt hạn theo `PaymentDeadlineAt` và BE chưa chứng minh xử lý tiền về sau khi đơn đã hủy. Đây là điều kiện chặn bật Stripe cho buyer.
- **Phạm vi hiện tại:** hiển thị Ví Nexus là lựa chọn thanh toán duy nhất có thể chọn. Thêm ô Stripe trong cùng nhóm phương thức nhưng vô hiệu hóa, ghi “Chưa khả dụng”; không gọi API Stripe cho đơn hàng. Ảnh còn có Express, Apple Pay, PayPal, Klarna, mã giảm giá và thuế nhập khẩu; không thêm các lựa chọn không thuộc luồng Nexus. Quote có trường giảm giá để hiển thị khoản đã được áp dụng, nhưng kế hoạch voucher Phase 2 đang hoãn nên chưa thêm ô nhập mã.
- **Uncertainty:** chưa có ảnh chụp checkout Nexus đang chạy ở desktop/mobile; bố cục thực tế cần được kiểm tra sau khi triển khai.

## Hướng thiết kế

**Màu:** chữ `#0f172a`, chữ phụ `#64748b`, nền `#f8fafc`, mặt thẻ `#ffffff`, viền `#e2e8f0` của Nexus. Thêm xanh chanh khoảng `#c8e71f` **chỉ trong checkout** cho bước hoàn tất và nút xác nhận; chữ trên nút màu `#0f172a`. Không đổi màu điều hướng toàn site.

**Chữ:** giữ Plus Jakarta Sans. Tiêu đề màn 24–28 px, tiêu đề nhóm 16–18 px, nhãn 13–14 px, số tiền chính 24–28 px với `tabular-nums`. Nội dung căn trái; tiền căn phải. Không dùng chữ siêu nhỏ theo tỷ lệ ảnh mẫu vì màn Nexus có dữ liệu và tiếng Việt dài hơn.

**Bố cục:** giới hạn chiều rộng phần checkout khoảng 1120–1200 px trong `buyer-main`; bước tiến trình ở đầu. Desktop chia cột khoảng 60/40, cách 16–20 px; mobile xếp một cột với tóm tắt sau biểu mẫu. Thẻ trắng bo 12 px, không đổ bóng hoặc tạo gradient mới. Chỉ khung đang cần thao tác có viền nhấn.

```text
Giỏ hàng  ✓ ───── Giao hàng & thanh toán  ● ───── Xác nhận  ○
┌─────────────────────────────┐  ┌──────────────────────┐
│ Địa chỉ nhận hàng / Sửa     │  │ Ảnh + tên + số lượng │
│ Thông tin liên hệ            │  │ Tạm tính hàng        │
│ Phí giao hàng theo báo giá   │  │ Phí giao hàng        │
│ ◉ Ví Nexus · số dư khả dụng  │  │ Giảm giá nếu có      │
│ ○ Stripe · Chưa khả dụng     │  │ Tổng từ quote        │
│ [Xem tổng thanh toán]        │  │ [Đặt hàng bằng ví]   │
└─────────────────────────────┘  └──────────────────────┘
```

**Điểm nhấn của ảnh được chuyển sang Nexus:** tiến trình rõ ràng, thông tin giao hàng có thể đọc lại và sửa, hai ô phương thức cùng kích thước/chiều cao, bảng giá có tổng tiền xác thực, CTA nằm sát tổng tiền. Ô Ví Nexus có radio được chọn, viền nhấn và số dư khả dụng. Ô Stripe có radio `disabled`, nền/viền trung tính và nhãn “Chưa khả dụng”; không dùng trạng thái hover hay con trỏ làm người dùng tưởng có thể chọn. Không tạo ô số thẻ, CVC hoặc biểu tượng ví điện tử chưa được hỗ trợ.

## Quyết định về luồng

Tách thao tác hiện tại thành **xem báo giá → xác nhận đặt hàng bằng Ví Nexus**. Sau khi địa chỉ hợp lệ, gọi quote theo contract hiện có (request quote chưa có `paymentMethod`) và giữ `quoteId`/`expiredAt` trong trạng thái trang. Tóm tắt bên phải chuyển từ tạm tính sang `grandTotal`, phí giao hàng và giảm giá từ `shops`. Chỉ khi người mua nhìn thấy tổng tiền mới mở nút “Đặt hàng bằng Ví Nexus”; chỉ gọi `POST /orders` khi số dư đủ. Ô Stripe không cập nhật state phương thức, không làm quote mất hiệu lực, không gửi `VnPay`/`Stripe`, không tạo đơn chờ và không chuyển sang Stripe. Khi sửa người nhận, số điện thoại, địa chỉ hoặc danh sách hàng được chọn, đánh dấu quote không còn hiệu lực và yêu cầu lấy báo giá mới. Email liên hệ và ghi chú không nằm trong request quote nên không tự làm hết hiệu lực báo giá. Nếu quote hết hạn hoặc backend từ chối `quoteId`, giữ dữ liệu form và hướng dẫn lấy lại báo giá. Không tạo đơn hai lần khi đang gửi.

**Luồng Stripe để triển khai sau:** sau khi các điều kiện BE bên dưới hoàn tất, bật radio Stripe, thêm quote/order theo phương thức Stripe, chuyển bằng `paymentUrl` của Commerce và theo dõi kết quả bằng `orderId`. URL quay về chỉ chọn đơn cần kiểm tra; chỉ Commerce `Paid` mới kết thúc đơn thành công. Toàn bộ logic tạo đơn Stripe, redirect, resume và màn kết quả direct payment **không thuộc đợt triển khai checkout hiện tại**.

## Reuse

- Dùng `Card`, `Badge`, `BackendImage`, `.field`, `.button`, `formatMoney`, `--ink`, `--canvas`, `--line`, `--surface` hiện có.
- Giữ `CheckoutScreen`, `validateShipping`, lưu địa chỉ tạm, chọn sản phẩm từ giỏ và màn thành công hiện tại. Dùng dữ liệu quote thật làm nguồn cho tóm tắt sau báo giá. Không dùng trạng thái nạp ví Stripe cho checkout khi Stripe đang vô hiệu hóa.
- Dùng các lớp `.checkout-*` đang thuộc riêng màn này; gom quy tắc CSS trùng của `.checkout-layout` và các media query liên tiếp khi chỉnh sửa. Không tạo thư viện giao diện mới chỉ cho một trang.

## Các thay đổi dự kiến

1. `src/features/commerce/BuyerCommerceScreens.tsx`
   - Thêm thanh tiến trình ba mốc phản ánh đúng ba trạng thái hiện có: Giỏ hàng, Giao hàng & thanh toán, Xác nhận. Mốc cuối chỉ hoàn tất khi backend trả trạng thái đơn đã thanh toán.
   - Sau quote hợp lệ, thu gọn form thành hai hàng “Liên hệ” và “Giao tới” với nút “Sửa”, như nhịp bố cục của ảnh. Nút “Sửa” mở lại đủ trường; giữ kiểm tra lỗi và focus trường sai. Có thể hiện “Đã tính phí giao hàng tới [địa chỉ]”, nhưng không hiện “đã giao” hoặc ngày giao dự kiến khi API chưa trả dữ liệu đó.
   - Thêm nhóm phương thức gồm **Ví Nexus** và **Stripe**. Ví Nexus được chọn mặc định. Stripe hiển thị như một tùy chọn `disabled` thực sự, có nhãn “Chưa khả dụng” và mô tả ngắn “Thanh toán trực tiếp qua Stripe đang hoàn thiện”. Không dùng một nút chỉ có vẻ bị khóa bằng CSS; chuột, bàn phím và trình đọc màn hình đều không thể chọn Stripe. Không hiển thị CTA Stripe hay hứa hẹn thời điểm mở.
   - Tách gọi quote khỏi `POST /orders`; lưu báo giá, hiển thị trạng thái tải/lỗi/hết hạn, vô hiệu hóa quote khi dữ liệu thay đổi. Nút thanh toán cuối đặt ở tóm tắt, dùng `quoteId` hợp lệ. Request quote giữ đúng contract hiện có; chỉ `POST /orders` gửi `paymentMethod: "Wallet"`. Không gửi `VnPay` qua nhánh Stripe chưa hoàn thiện.
   - Mở rộng kiểu `CheckoutQuoteResponse` theo contract BE: các trường tổng hàng, giảm giá, phí vận chuyển và tổng theo shop. Hiển thị tổng `grandTotal` từ backend; không tự suy diễn thuế hay chi phí.
2. `src/styles/globals.css`
   - Thu gọn phần checkout thành hai thẻ tách bạch, viền và khoảng cách như ảnh; bổ sung lớp tiến trình, hai ô chọn thanh toán và accent xanh chanh cục bộ. Ở ≤900 px chuyển một cột; ở ≤600 px nút thanh toán chiếm toàn chiều rộng, bảng giá không bị tràn khi tên hàng/tiền dài.
   - Giữ trạng thái focus rõ, `aria-invalid` và màu lỗi hiện có; xanh chanh dùng chữ tối để đủ tương phản.
3. Nếu tách thành phần, chỉ tách `CheckoutProgress`, `PaymentMethodChoice` và `CheckoutSummary` trong `src/features/commerce/checkout/` khi điều đó làm rõ trạng thái quote/order và tránh JSX trong `BuyerCommerceScreens.tsx` phình thêm. Không tạo primitive toàn site chỉ cho checkout.

**Đợt sau, khi bật Stripe:** mở rộng `CreateOrderResponse.paymentUrl`, sửa type direct checkout cũ ở `src/features/wallet/services/wallet.service.ts`, nối `GET /checkout/direct/{orderId}` và màn `/buyer/payment/result`. FE dùng `paymentUrl` Commerce trả sau `POST /orders`; không tự tạo phiên thứ hai. Các thay đổi này được ghi lại để triển khai sau, không gọi API hay hiển thị CTA Stripe trong đợt hiện tại.

## Điều kiện backend trước khi bật Stripe

1. **Định danh phương thức:** Commerce nên có `PaymentMethod.Stripe` trong quote/order/response và worker tương ứng, hoặc một contract chuyển tiếp được kiểm thử rõ rằng `VnPay` trong API hiện tại thực sự là Stripe. Nếu thêm enum, xử lý dữ liệu đơn cũ và hiển thị đúng tên trên chi tiết đơn, báo cáo, hoàn tiền.
2. **Callback đúng đơn:** Wallet direct Checkout Session cần thêm `kind=order&orderId=<id>` vào cả success/cancel URL (tương tự top-up), giữ luồng đơn và nạp ví phân biệt; `GET /checkout/direct/{orderId}` vẫn kiểm tra chủ giao dịch. Không dựa vào một khóa `sessionStorage` cho nhiều đơn/tab.
3. **Hạn và tiền về muộn:** Commerce đang hủy đơn `PendingPayment` sau 15 phút, trong khi Wallet chưa ràng buộc thời hạn Stripe Session với `PaymentDeadlineAt`. BE phải bảo đảm không thể ghi nhận thanh toán cho đơn đã hủy mà không có bù trừ/refund và đối soát; kiểm thử race giữa webhook, polling đơn và timeout worker. FE không thể giải quyết nguy cơ này bằng đồng hồ đếm ngược.
4. **Webhook và phục hồi:** xác nhận Gateway chuyển nguyên body/`Stripe-Signature`; có đối soát direct order khi webhook trễ hoặc thất lạc (worker nạp ví hiện chỉ quét top-up). Một endpoint tiếp tục thanh toán đơn cần xác minh buyer, đơn còn `PendingPayment`, hạn còn hiệu lực và phiên Stripe còn mở trước khi trả URL cũ hoặc tạo phiên thay thế theo quy tắc BE.

## Phạm vi

- **Kế thừa:** header, navigation và bố cục Buyer hiện có.
- **Kiểm tra ảnh hưởng:** từ giỏ hàng chọn một phần sản phẩm, báo giá và tạo đơn bằng Ví Nexus, màn thành công và chi tiết đơn. Ô Stripe xuất hiện nhưng không tham gia bất kỳ bước thanh toán nào. Không sửa luồng nạp ví.
- **Loại trừ trong đợt hiện tại:** tạo đơn Stripe, redirect sang Stripe, callback, resume và thay đổi BE; form nhập thẻ trong Nexus, Apple Pay/PayPal/Klarna như lựa chọn riêng, tùy chọn giao nhanh, nhập voucher và thuế nhập khẩu. Các điều kiện BE ở trên là công việc riêng trước khi phát hành Stripe checkout.

## Kiểm thử nghiệm thu

- **Sản phẩm:** quote hiển thị đúng tổng hàng, phí theo shop, giảm giá và `grandTotal`; nút cuối chỉ ghi số tiền sẽ trừ Ví Nexus. Đơn chỉ được tạo sau khi người mua đã xem quote. Stripe hiện diện với trạng thái vô hiệu hóa và lý do rõ ràng.
- **Ví Nexus:** địa chỉ thiếu/sai, quote lỗi, quote hết 15 phút, sửa form sau quote, thay đổi giỏ, ví thiếu tiền, gửi lặp, order trả trạng thái chưa `Paid`, thanh toán thành công.
- **Stripe trong đợt hiện tại:** click/Enter/Space không chọn được Stripe; Tab không đưa focus vào radio bị khóa; state vẫn là Wallet; không có request quote/order với `VnPay` hoặc `Stripe`; không hiện nút “Tiếp tục với Stripe”. Vẫn có thể đọc nhãn và lý do vô hiệu hóa.
- **Stripe khi mở sau này:** quote/order dùng đúng cùng phương thức; `paymentUrl` thiếu hoặc lỗi; gửi lặp; mở Stripe, quay về success/cancel, Back/đóng tab, webhook đến chậm/lặp, tab khác mở cùng đơn, phiên đăng nhập hết hạn, người khác mở URL, phiên Stripe hết hạn, đơn quá hạn 15 phút, thanh toán thành công sát hạn. Kiểm tra cả Wallet direct `Success` và Commerce order `Paid` trước nhãn kết thúc; tổng tiền không thay đổi giữa quote, order và Stripe.
- **Giao diện:** desktop 1440/1024 px, tablet 900 px, mobile 390/320 px; tên sản phẩm dài, nhiều shop, số tiền dài, focus bàn phím, thông báo lỗi và tải.
- **Repository trong đợt hiện tại:** FE `npm run lint`, `npm run typecheck`, `npm run build`; luồng giỏ → quote → order bằng ví tiếp tục đạt. Test Commerce/Wallet và Stripe test mode là cổng nghiệm thu **đợt bật Stripe sau này**.

## Stop conditions

- Dừng phần **hiển thị phí/tổng cuối** nếu response quote thực tế không còn các trường nêu trên; xác minh lại contract trước khi viết công thức thay thế.
- Giữ ô Stripe **hiển thị nhưng disabled** bất kể cấu hình môi trường hoặc dữ liệu runtime trong đợt hiện tại. Chỉ thay đổi trạng thái này bằng một yêu cầu phát hành riêng sau khi callback định danh đúng `orderId`, tiền về sau hủy đã được xử lý và contract `VnPay`/`Stripe` thống nhất.
- Dừng phần **thanh toán cuối** nếu BE thay đổi semantics của `quoteId` hoặc phương thức Wallet; không dựng lựa chọn thanh toán giả.

## Design documentation

- Sau khi triển khai và kiểm tra trực quan: ghi nhận accent xanh chanh là ngoại lệ cục bộ cho checkout, nếu repository có tài liệu thiết kế chính thức. Hiện chưa có `DESIGN.md` trong FE.
