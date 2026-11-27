# Kế hoạch Chặn Chọn & Chặn Thanh Toán Khi Voucher Không Hợp Lệ Ở Checkout (FE)

> **Vị trí lưu trữ:** `.agents/plans/2026-11-28_0230-plan-voucher-hard-block-checkout.md`
> **Trạng thái:** Chờ người dùng phê duyệt trước khi sửa mã nguồn.

- **Thời gian lập:** 2026-11-28, 02:30 (UTC+7)
- **Thời gian cập nhật:** 2026-11-28, 02:30 (UTC+7)

---

## 1. Mục tiêu (Objective)
Đảm bảo người mua không bao giờ rơi vào trạng thái chọn voucher không áp dụng được mà vẫn bấm thanh toán được đơn hàng (trả giá gốc không có giảm giá):
1. **Chặn ngay khi chọn voucher trên UI (`CheckoutVoucherPanel`):** Không cho chọn (hoặc nhả lỗi ngay và từ chối lưu lựa chọn) khi mã vi phạm giới hạn tầng (`Product`/`Shop` cùng shop, hoặc `>= 2` mã `System`), hoặc khi chọn mã khiến phần tiền hàng còn lại sau tầng trước rơi xuống dưới `minOrderAmount` của mã tầng sau.
2. **Chặn cứng bước báo giá & đặt hàng (`CheckoutScreen`):**
   - Khi Backend trả lỗi voucher (HTTP 400/409 từ `/api/v1/checkouts/quote`), xóa ngay quote cũ (`setQuoteState(null)`), hiển thị thông báo lỗi tiếng Việt rõ ràng để người dùng bỏ hoặc đổi mã khác.
   - Nếu quote có `rejectedVouchers` hoặc đang có cảnh báo xung đột voucher, **khóa cứng nút Đặt hàng** (`disabled`) và chặn trong `handlePlaceOrder()`.
3. **Đồng bộ từ điển lỗi & hợp đồng `validate`:** Hỗ trợ đầy đủ các mã lỗi mới (`VOUCHER_MIN_ORDER_NOT_MET`, `VOUCHER_NOT_ACTIVE`, `VOUCHER_NOT_STARTED`, `VOUCHER_SCOPE_MISMATCH`, `VOUCHER_EVALUATION_FAILED`) và lưu thông tin đầy đủ khi nhập mã thủ công.

---

## 2. Context & Files đã đọc
- `src/features/commerce/BuyerCommerceScreens.tsx` (`CheckoutScreen`)
- `src/features/commerce/checkout-outcome.ts`
- `src/features/coupons/CheckoutVoucherPanel.tsx`
- `src/features/coupons/voucher-calculator.ts`
- `src/features/coupons/voucher-rules.ts`
- `src/features/coupons/voucher-outcome.ts`
- `src/features/coupons/services/discount.service.ts`
- `src/lib/errors/error-messages.ts`
- `tests/checkout-outcome.test.mjs`

---

## 3. Phân tích rủi ro & Phạm vi ảnh hưởng (Impact Analysis)
- **GitNexus `impact`:**
  - `CheckoutVoucherPanel`: Risk `LOW`, chỉ có 1 caller trực tiếp là `CheckoutScreen` (`src/features/commerce/BuyerCommerceScreens.tsx`).
  - `CheckoutScreen`: Grep xác nhận chỉ được export qua `ClientScreens.tsx` cho route `/buyer/checkout`.
- **Rủi ro chính:** Khi nhập mã thủ công không nằm trong danh sách `available`, FE cần các trường `ownerSellerId`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscountAmount` từ API `validate` để kiểm tra đủ tầng trừ và xung đột shop; thiếu các trường này sẽ fallback về quy tắc an toàn là khóa các mã cùng nhóm non-system chưa rõ shop.

---

## 4. Checklist các bước thực hiện (Step-by-Step Implementation)
1. **Mở rộng `ValidateVoucherResponse` & `voucher-calculator.ts` (`discount.service.ts`, `voucher-calculator.ts`):**
   - Thêm các field optional `ownerSellerId`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscountAmount` vào `ValidateVoucherResponse`.
   - Bổ sung hàm kiểm tra tương thích trước khi chọn trong `voucher-calculator.ts` (ví dụ `validateVoucherCombination(items, currentVouchers, candidate)`): kiểm tra xem sau khi ghép `candidate` vào tổ hợp `Product -> Shop -> System`, tất cả các mã đã chọn (đặc biệt mã `System` hoặc `Shop`) có còn đạt `minOrderAmount` trên phần tiền còn lại hay không; nếu không đạt thì trả thông báo lỗi cụ thể.
2. **Chặn ngay khi bấm chọn / nhập mã trong `CheckoutVoucherPanel.tsx`:**
   - Trong `toggle(item)` và `addManual()`: trước khi gọi `onChange`, chạy cả `canSelectVoucher` lẫn kiểm tra tổ hợp đa tầng (`validateVoucherCombination`). Nếu có xung đột hoặc tụt dưới `minOrderAmount`, **không thêm mã** (chặn người dùng chọn vào) và hiển thị thông báo lỗi rõ ràng để chọn mã khác.
   - Đánh dấu `disabled` kèm dòng giải thích trực tiếp trên các option sẽ bị không hợp lệ nếu chọn kèm tổ hợp hiện tại (ví dụ: `"Đơn còn 150.000 ₫ sau khi giảm shop/SP, chưa đủ tối thiểu 180.000 ₫"`).
   - Cho phép truyền prop/callback lỗi hoặc nhận `quoteError` hiển thị đồng bộ ngay trong khối voucher để người dùng biết mã nào đang gây chặn.
3. **Giữ nguyên trạng thái địa chỉ & báo giá khi tích/bỏ tích voucher (`BuyerCommerceScreens.tsx` — `CheckoutScreen`):**
   - Khắc phục lỗi khi tích/bỏ tích voucher (làm `quoteKey` đổi và `quoteReady` thành `false`) khiến `(!quoteReady || editingShipping)` bật lại form nhập địa chỉ, remount `GhnLocationSelect` và làm mất phí vận chuyển đã báo giá:
     - Tách riêng trạng thái `shippingConfirmed` (bật khi đã lấy được báo giá cho địa chỉ hiện tại và `!editingShipping`) và `lastShippingQuote` (lưu `shippingFee`, `itemsAmount` theo `shippingKey` + `items`).
     - Khi `!editingShipping && shippingConfirmed`, luôn giữ nguyên thẻ tóm tắt địa chỉ (`.checkout-address-review`) và phí vận chuyển đã báo giá khi tích/bỏ tích voucher hoặc đổi phương thức thanh toán; chỉ mở lại form địa chỉ khi người dùng chủ động bấm **"Sửa thông tin"**.
     - Tự động gọi lại báo giá ngầm theo `shippingConfirmed && !editingShipping && !quoteReady` (không bung lại form địa chỉ, chặn lặp khi `lastAutoQuotedRef.current === quoteKey`).
4. **Khóa cứng Đặt hàng khi có lỗi voucher trong `BuyerCommerceScreens.tsx` (`CheckoutScreen`):**
   - Trong `fetchQuote`: khi `api.post("/api/v1/checkouts/quote")` thất bại (ví dụ BE trả 400 do voucher), xóa ngay `quoteState` (`setQuoteState(null)`) nhưng vẫn giữ `shippingConfirmed` và `lastShippingQuote`, đồng thời hiển thị lỗi rõ ràng qua `quoteError`.
   - Tính `hasRejectedVoucher = Boolean(activeQuote?.rejectedVouchers?.length)` và `hasVoucherBlocking = hasRejectedVoucher || voucherEstimate.warnings.length > 0`.
   - Khóa nút `"Đặt hàng bằng Ví Nexus"` / `"Đặt hàng (thanh toán khi nhận)"` khi `hasVoucherBlocking` đúng (hoặc `activeQuote` chưa sẵn sàng), và trong `handlePlaceOrder()` return sớm với `setSubmitError(...)` nếu có voucher bị từ chối.
5. **Cập nhật từ điển lỗi (`src/lib/errors/error-messages.ts`):**
   - Thêm các mã `VOUCHER_MIN_ORDER_NOT_MET`, `VOUCHER_NOT_ACTIVE`, `VOUCHER_NOT_STARTED`, `VOUCHER_SCOPE_MISMATCH`, `VOUCHER_EVALUATION_FAILED` bằng tiếng Việt rõ ràng kèm `hint: "Bỏ hoặc chọn mã giảm giá khác rồi lấy báo giá lại."`.
6. **Bổ sung Unit Tests & kiểm tra Playwright (`tests/checkout-outcome.test.mjs`):**
   - Test `validateVoucherCombination` cho case chọn `Product`/`Shop` làm `System` tụt dưới `minOrderAmount`, và case chọn `System` khi đang có `Product` làm không đủ điều kiện.
   - Chạy Playwright mô phỏng: nhập địa chỉ -> xem tổng thanh toán -> tích chọn voucher -> bỏ tích voucher -> xác nhận **thẻ địa chỉ giữ nguyên (không bung lại form nhập)**, **phí ship giữ nguyên**, và khi chọn voucher lỗi thì **nút thanh toán bị khóa và hiện lỗi rõ ràng**.

---

## 5. Kế hoạch kiểm chứng (Verification)
```bash
npm run typecheck
npm run lint
node --experimental-transform-types --loader ./tests/alias-loader.mjs --test tests/checkout-outcome.test.mjs tests/api-client-session.test.mjs tests/auth-google.test.mjs
npm run build
```
