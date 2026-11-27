# Kế hoạch Toàn diện Luồng Giỏ hàng, Checkout Voucher & Giao diện Đơn mua / SubOrder kiểu Shopee (FE)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-28_0315-plan-checkout-voucher-cart-va-suborder-shopee-ux.md`
> **Note ngữ cảnh:** `.agents/notes/2026-11-28_0315-checkout-voucher-va-suborder-shopee-ux.md`
> **Tham chiếu Design System:** `DESIGN.md`
> **Trạng thái:** ✅ ĐÃ HOÀN THÀNH (`typecheck`, `lint`, unit tests 39/39, `build`, Playwright E2E passed).

- **Thời gian lập:** 2026-11-28, 03:15 (UTC+7)
- **Thời gian cập nhật:** 2026-11-28, 04:20 (UTC+7)

---

## 1. Mục tiêu (Objective)
Triển khai đồng bộ toàn bộ nâng cấp trải nghiệm Giỏ hàng, Checkout Voucher và cấu trúc Đơn mua / SubOrder kiểu Shopee:
1. **Giỏ hàng (`CartScreen`):** Khi thêm sản phẩm mới vào giỏ hàng, sản phẩm đó mặc định **chưa được chọn** (không tự tích chọn sẵn).
2. **Checkout Voucher & Địa chỉ (`CheckoutVoucherPanel`, `CheckoutScreen`):**
   - Bỏ các dòng note giải thích dài dòng ở đầu nhóm voucher (`"Trừ trước theo sản phẩm"`, ...); khi chọn 1 mã thì mã xung đột / không đủ điều kiện đa tầng tự mờ (`disabled`) và khóa không chọn được.
   - Chặn ngay khi chọn mã không hợp lệ / vi phạm điều kiện tầng `Product -> Shop -> System`; đồng thời khóa cứng nút đặt hàng khi có voucher lỗi hoặc bị từ chối, hiển thị lỗi rõ ràng để chọn mã khác.
   - Sửa lỗi **"Chọn mã tốt nhất"** phía FE cho COD (`cashOnDelivery` lọc bỏ mã `System` và giữ đúng mã hợp lệ nhất).
   - Khi đã xác nhận địa chỉ (`!editingShipping`): tích/bỏ tích voucher hoặc check giá lại **giữ nguyên khối tóm tắt địa chỉ và phí ship**, không bung lại form nhập địa chỉ, và vẫn hiển thị đầy đủ các dòng giảm giá + giá tổng gạch ngang + giá cuối.
3. **Đơn mua & Chi tiết Order / SubOrder kiểu Shopee (`/buyer/orders/[id]` & trang chi tiết `SubOrder`):**
   - Sau khi đã đặt hàng (`OrderDetail` / `SubOrderDetail`), **bỏ nút đổi địa chỉ đặt hàng** (`ChangeAddressButton`).
   - Tại `/buyer/orders/[id]`:
     - Thêm **thanh tiến trình kiểu Shopee có thể ấn vào từng trạng thái** (`Tất cả`, `Chờ thanh toán`, `Đã thanh toán`, `Chờ lấy hàng`, `Đang giao hàng`, `Đã giao / Hoàn tất`, `Đã hủy / Hoàn tiền`), đếm số lượng và lọc hiển thị đúng các `SubOrder` thuộc trạng thái đang chọn.
     - Mỗi `SubOrder` hiển thị thành 1 card tóm tắt gọn: tiêu đề **tên Shop** + **badge trạng thái**, **1 món hàng đầu tiên** của shop đó, tóm tắt số món & tổng tiền, và nút điều hướng sang **trang chi tiết `SubOrder`**.
     - Ở khung tóm tắt Order cha: hiển thị đầy đủ các dòng chi tiết giảm giá (ghi rõ giảm theo loại gì + mã nào), tổng tiền gốc kèm ship có gạch ngang và tổng cuối; bỏ dòng `Mã Buyer`, tách thông tin giao & thời gian tạo đơn hợp lý.
   - Tại **Trang chi tiết `SubOrder`** (`/buyer/orders/[id]/sub-orders/[subOrderId]` và liên kết từ `/buyer/orders/by-sub/[id]`):
     - **Bố cục 2 cột (2/3 trái + 1/3 phải):**
       - **Cột trái (2/3):**
         - **Card 1 (trên danh sách sản phẩm):** hiển thị gọn **tên shop + địa chỉ nhận hàng** (không hiện địa chỉ gửi hàng của shop); ấn vào mở **Popup chi tiết người nhận** (tên shop, người nhận, SĐT, địa chỉ giao hàng, thời gian tạo đơn, phương thức thanh toán).
         - **Card 2 (Danh sách sản phẩm & thanh toán):** hiển thị toàn bộ sản phẩm trong `SubOrder` kèm **số lượng kế bên**, **giá record lúc mua hàng** (gạch ngang giá gốc nếu có giảm sản phẩm). Ấn vào từng sản phẩm mở **Popup thông tin cơ bản của sản phẩm** (lấy từ `GET /api/v1/products/{productId}`, fallback snapshot đơn hàng) kèm **nút nhỏ ở góc trên bên phải** điều hướng sang `/catalog/{productId}`. Bên dưới có **nút dropdown xổ xuống kiểu Shopee** cho phần tổng tiền: liệt kê chi tiết đã giảm gì, bao nhiêu, tổng ban đầu (tiền hàng + ship lúc chưa giảm), và tổng thanh toán cuối.
       - **Cột phải (1/3):**
         - **Card Thông tin giao hàng:** mã đơn con (`subOrderNo`), mã vận đơn (nếu có), trạng thái chuẩn bị/giao hàng (chờ người bán xác nhận / người bán đang chuẩn bị hàng / đang giao...), và nút **Xem hành trình đơn hàng** (hiển thị đủ các mốc cũ `Đặt đơn`, `Đã thanh toán / Chờ người bán xác nhận`, mốc `Người bán đã xác nhận`, và hành trình GHN).

---

## 2. Context & Files liên quan
- `src/features/commerce/cart-selection.ts` & `tests/cart-selection.test.mjs`
- `src/features/commerce/BuyerCommerceScreens.tsx` (`CartScreen`, `CheckoutScreen`, `OrdersScreen`, `OrderDetailScreen`)
- `src/features/commerce/OrderBySubOrderScreen.tsx`
- `src/features/commerce/OrderActions.tsx`
- `src/features/commerce/SubOrderDetailScreen.tsx` (mới — tách module sạch sẽ cho trang chi tiết SubOrder + Popup sản phẩm + Popup địa chỉ + Dropdown giảm giá)
- `src/app/(marketplace)/buyer/orders/[id]/sub-orders/[subOrderId]/page.tsx` (mới)
- `src/constants/routes.ts`
- `src/features/coupons/CheckoutVoucherPanel.tsx`, `voucher-calculator.ts`, `voucher-rules.ts`, `services/discount.service.ts`
- `src/features/fulfillment/components/ShipmentTimelineList.tsx` & `OrderProgressStepper.tsx`
- `src/lib/errors/error-messages.ts`
- `src/styles/globals.css`
- `tests/checkout-outcome.test.mjs`

---

## 3. Phân tích rủi ro & Phạm vi ảnh hưởng (Impact Analysis)
- **`cart-selection.ts`:** Thay đổi hành vi mặc định từ auto-select sang unselect khi thêm mới/lần đầu vào giỏ -> cần cập nhật các assertions tương ứng trong `tests/cart-selection.test.mjs`.
- **`CheckoutScreen` (`BuyerCommerceScreens.tsx`):** Chỉ ảnh hưởng `/buyer/checkout`; cần bảo đảm khi `voucherCodes` hoặc `paymentMethod` thay đổi, `activeQuote` cũ không dùng để `handlePlaceOrder()`, nhưng UI địa chỉ (`!editingShipping`) và `lastShippingQuote` vẫn giữ nguyên.
- **Route mới `/buyer/orders/[id]/sub-orders/[subOrderId]`:** Giữ nguyên route `/buyer/orders/[id]` và `/buyer/orders/by-sub/[id]` để không gãy bookmark hoặc link từ notification.

---

## 4. Checklist các bước thực hiện (Step-by-Step Implementation)

### Bước 1: Giỏ hàng — Không tự chọn sản phẩm mới thêm
1. Sửa `reconcileCartSelection` trong `src/features/commerce/cart-selection.ts`:
   - Khi `stored === null` hoặc gặp item mới (`!prevKnown.has(id)`), giữ nguyên `selectedIds` hiện có (chỉ thêm `id` vào `knownIds`), không tự động đưa vào `selectedIds`.
2. Cập nhật `tests/cart-selection.test.mjs` kiểm chứng mặc định item mới chưa được chọn và các item đã tích trước đó vẫn giữ nguyên.

### Bước 2: Checkout Voucher, Chặn Lỗi & Giữ Địa chỉ + Báo giá
1. **`CheckoutVoucherPanel.tsx`, `voucher-calculator.ts`, `voucher-outcome.ts` & `discount.service.ts`:**
   - Bỏ các text `hint` dưới tiêu đề 3 nhóm voucher (`Product`, `Shop`, `System`).
   - Bổ sung `validateVoucherCombination` trong `voucher-calculator.ts` kiểm tra đủ cả xung đột shop/sàn và điều kiện `minOrderAmount` 2 chiều sau tầng trước (chặn cả chọn `System` trước rồi chọn `Product/Shop` làm tụt dưới ngưỡng `System`).
   - Khi chọn 1 mã khiến mã khác xung đột hoặc không đủ điều kiện tầng sau, làm mờ & khóa (`disabled`) các mã đó; khi bấm/nhập tay mã không hợp lệ thì chặn và hiện lỗi ngay tại panel.
   - Mở rộng `ValidateVoucherResponse` nhận thêm `ownerSellerId`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscountAmount` và truyền đầy đủ vào `addManual`.
   - Sửa `ineligibleText` nhận diện rõ `"VOUCHER_OUT_OF_STOCK"` và `"VOUCHER_USAGE_LIMIT_EXCEEDED"`.
   - Sửa `recommend()`: truyền `paymentMethod` (`Cod` / `Wallet`) lên `/api/v1/discounts/recommend`, đồng thời lọc bỏ `System` khi `cashOnDelivery` bật.
2. **`BuyerCommerceScreens.tsx` (`CheckoutScreen`) & `error-messages.ts`:**
   - Tách `shippingConfirmed` và `lastShippingQuote` để khi tích/bỏ tích voucher hoặc check giá lại, khối `.checkout-address-review` và phí ship giữ nguyên, không bung lại form nhập địa chỉ; ẩn nút `"Sửa thông tin"` khi `submitting` / `unknownOutcome`.
   - **Chống deadlock auto-quote:** Cho phép `useEffect` auto-quote chạy bất kỳ khi nào `shippingConfirmed && !editingShipping && !quoteReady && !quoting && !quoteLock.current && lastAutoQuotedRef.current !== quoteKey` (không phụ thuộc `quoteState != null`!). Khi `fetchQuote` báo lỗi voucher, xóa `quoteState` (`setQuoteState(null)`) để khóa nút Đặt hàng nhưng giữ nguyên `shippingConfirmed` + `lastShippingQuote` — khi người dùng bỏ mã lỗi, `useEffect` tự động báo giá lại ngay.
   - Khóa cứng nút Đặt hàng khi `Boolean(quoteError) || Boolean(activeQuote?.rejectedVouchers?.length) || voucherEstimate.warnings.length > 0`.
   - Bổ sung đầy đủ mapping các mã lỗi voucher (`VOUCHER_MIN_ORDER_NOT_MET`, `VOUCHER_NOT_ACTIVE`, `VOUCHER_NOT_STARTED`, `VOUCHER_SCOPE_MISMATCH`, `VOUCHER_EVALUATION_FAILED`, `SHOP_MULTIPLE_VOUCHERS_NOT_ALLOWED`) vào `src/lib/errors/error-messages.ts`.

### Bước 3: Đơn mua (`/buyer/orders/[id]`) & Trang Chi tiết SubOrder (2/3 - 1/3)
1. **Loại bỏ nút đổi địa chỉ sau khi đặt hàng (`BuyerCommerceScreens.tsx`):**
   - Gỡ `ChangeAddressButton` khỏi giao diện đơn mua đã đặt (`OrderDetailScreen` / `SubOrderDetailScreen`) theo đúng yêu cầu.
2. **Tái cấu trúc `/buyer/orders/[id]` (`OrderDetailScreen`):**
   - Bổ sung **thanh tiến trình trạng thái kiểu Shopee** (dựa trên các trạng thái `SubOrder`: `Tất cả`, `Chờ thanh toán`, `Đã thanh toán`, `Chờ lấy hàng`, `Đang giao hàng`, `Đã giao / Hoàn tất`, `Đã hủy / Hoàn hàng`) với số lượng từng trạng thái, có thể bấm để lọc `SubOrder` tương ứng.
   - Mỗi `SubOrder` hiển thị dạng **card tóm tắt gọn**: tiêu đề **tên Shop thật** (tra cứu `/api/v1/sellers/{sellerId}` nếu BE trả fallback) + **badge trạng thái**, **1 món hàng đầu tiên** (ảnh, tên sản phẩm, số lượng, giá), và nút **"Xem chi tiết đơn hàng shop"** dẫn tới `/buyer/orders/[id]/sub-orders/[subOrderId]`.
   - Khung tóm tắt Order cha hiển thị các dòng giảm giá chi tiết (`Giảm giá sản phẩm`, `Giảm giá từ shop`, `Giảm giá toàn sàn` kèm mã), tổng gốc kèm ship gạch ngang + tổng thanh toán cuối; **bỏ dòng `Mã Buyer`**, tách thông tin giao & thời gian tạo đơn rõ ràng.
3. **Tạo Trang Chi tiết SubOrder (`SubOrderDetailScreen.tsx` & route `/buyer/orders/[id]/sub-orders/[subOrderId]`):**
   - **Cột trái (2/3):**
     - **Card Thông tin nhận hàng (phía trên):** hiển thị gọn tên shop + địa chỉ nhận hàng (không hiển thị địa chỉ gửi hàng của shop); ấn vào mở **Popup chi tiết** (tên shop, người nhận, SĐT, địa chỉ giao hàng, thời gian tạo đơn, phương thức thanh toán).
     - **Card Sản phẩm & Thanh toán:** danh sách toàn bộ sản phẩm trong `SubOrder` với ảnh, **số lượng kế bên**, **giá record lúc mua** (gạch ngang giá gốc nếu có giảm sản phẩm). Bấm vào sản phẩm mở **Popup chi tiết sản phẩm cơ bản** (fetch `/api/v1/products/{productId}`, fallback snapshot) có **nút nhỏ ở góc trên phải** dẫn sang `/catalog/{productId}`. Bên dưới có **nút dropdown xổ xuống kiểu Shopee** hiện chi tiết các khoản giảm giá (loại + mã + số tiền), tổng ban đầu (tiền hàng + ship trước giảm, gạch ngang), và tổng cuối.
   - **Cột phải (1/3):**
     - **Card Thông tin giao hàng:** mã đơn con (`subOrderNo`), trạng thái chuẩn bị hàng của Seller / trạng thái vận chuyển, mã vận đơn (`trackingCode`), nút **Xem hành trình đơn hàng** (mở `ShipmentTimelineList` hiển thị đủ các mốc từ lúc đặt đơn -> chờ seller xác nhận -> seller đã xác nhận -> GHN).
   - Giữ đầy đủ các thao tác cấp `SubOrder` ngay trên `SubOrderDetailScreen` (`Đã nhận được hàng`, `Hủy đơn hàng con` nếu có, `Đánh giá sản phẩm và gian hàng`, `Báo cáo vấn đề với người bán`, banner trạng thái hoàn tất/từ chối/hủy) để không mất tính năng khi thu gọn `SubOrder` card ở `/buyer/orders/[id]`.
   - Cập nhật `OrderBySubOrderScreen.tsx` & `ROUTES.buyer.subOrder(orderId, subOrderId)` để hỗ trợ mở trực tiếp trang chi tiết `SubOrder`.

### Bước 4: Styling & Responsive (`globals.css`)
- Bổ sung layout grid 2/3 - 1/3 (`suborder-detail-grid`, responsive về 1 cột trên mobile/tablet), style thanh tiến trình Shopee, card `SubOrder` tóm tắt, nút dropdown thanh toán, và modal chi tiết sản phẩm / địa chỉ theo đúng `DESIGN.md`.

---

## 5. Kế hoạch kiểm chứng (Verification)
```bash
npm run typecheck
npm run lint
node --experimental-transform-types --loader ./tests/alias-loader.mjs --test tests/cart-selection.test.mjs tests/checkout-outcome.test.mjs tests/api-client-session.test.mjs tests/auth-google.test.mjs
npm run build
```
- Chạy Playwright kiểm tra thực tế:
  1. Giỏ hàng: món mới thêm mặc định chưa chọn.
  2. Checkout: tích/bỏ tích voucher không bung lại form địa chỉ, giữ nguyên phí ship, nút "Chọn mã tốt nhất" tối ưu 3 tầng, voucher lỗi chặn thanh toán.
  3. `/buyer/orders/[id]` và `/buyer/orders/[id]/sub-orders/[subOrderId]`: thanh tiến trình bấm lọc từng `SubOrder`, card tóm tắt 1 sản phẩm + tên shop, bố cục 2/3 - 1/3, popup sản phẩm có nút góc trên phải, popup địa chỉ nhận hàng, dropdown giảm giá + tổng gạch ngang, và hành trình đơn hàng đủ cả mốc chờ & đã xác nhận.
