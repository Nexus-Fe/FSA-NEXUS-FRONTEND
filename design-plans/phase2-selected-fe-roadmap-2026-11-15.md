# Kế hoạch FE Phase 2 theo các quyết định ngày 15/11/2026

Written against: FE `dev` @ `c9ee565`; AuctionService `dev` @ `4ef45c2`; CatalogService `dev` @ `5b9f76a` cộng 2 file local chưa commit. Báo cáo đầu vào `phase2_and_auction_code_review_report_14112026.md` là nguồn đối chiếu, không phải lệnh thực thi. Không sửa mã sản phẩm khi lập kế hoạch này.

## Phạm vi và nguyên tắc

- Triển khai FE cho đấu giá, Catalog, P2-02, P2-03, P2-05, P2-06, P2-07. Giữ P2-01, P2-04, P2-08 và các thay đổi BE về cọc trong mục tạm hoãn.
- Bảo toàn thiết kế Nexus: `Plus Jakarta Sans`, các biến `--ink`, `--canvas`, `--surface`, `--sky`, `--line` trong `src/styles/globals.css`; dùng `Card`, `PageHeading`, `Badge`, trường nhập, bảng và trạng thái tải/lỗi hiện có. Bố cục hai vùng khi có form và lịch sử; xuống một cột trên mobile. Số tiền dùng `tabular-nums`. Không tạo bộ thẻ hay màu mới.
- Đưa API call vào service riêng theo domain, type từ DTO thật, dùng `unwrap` chung; xử lý lỗi theo `errorCode`. Mutation tài chính dùng trạng thái gửi, khóa nút và khóa idempotency phù hợp. FE không tự suy diễn tiền đã vào ví, cọc đã giữ hay hàng đã hoàn kho.
- Chỉ bật luồng nghiệp vụ khi Gateway và service trả đúng contract. UI có thể viết trước nhưng không báo “hoàn thành” nếu điều kiện BE chưa đạt.

## Thứ tự triển khai

### Gói 0 — Chốt contract và xử lý bản Catalog local

1. Trước khi sửa FE, ghi lại `git status` và `git diff` của CatalogService. Khi triển khai theo quyết định đã chốt, khôi phục **chỉ** `Catalog.Application/Services/Product/ProductRequests.cs` và `ProductService.cs` về `dev` sau khi xác nhận hai diff này là phần cũ cần bỏ; không dùng `git checkout -- .` trên toàn repo. Kiểm tra lại DTO sau khi khôi phục.
2. Lập bảng route thực chạy từ `Gateway/Gateway/appsettings.json`, không coi `appsettings.example.json` là cấu hình runtime. Kiểm tra ít nhất: `/api/v1/auction-orders/seller`, `/api/v1/admin/reports/products`, `/api/v1/reviews/{id}` và `/api/v1/seller/orders/{id}/confirm-return`. Ghi đầu việc Gateway riêng nếu route không đến đúng service.
3. Đóng băng contract FE theo Auction v0.4: API 04 callback đã bỏ; tài liệu `26_UPDATE_v0.4_option-C.md` thay thế API Wallet 14–17 cũ. Không thiết kế màn cọc theo Stripe redirect.

### Gói 1 — Đồng bộ Catalog và luồng tạo sản phẩm đấu giá

**FE:** `src/features/seller/SellerScreens.tsx`, `src/features/seller/services/catalog.service.ts`, màn chi tiết/sửa sản phẩm seller và form tạo phiên ở `src/features/auction/AuctionOperations.tsx`.

1. Tách rõ body Catalog và thao tác tồn Fulfillment. `POST /api/v1/products` và tạo biến thể chỉ gửi dữ liệu Catalog; bỏ `warehouseId` và `quantity` khỏi DTO Catalog. Chọn kho và nhập thêm hàng chỉ gọi API Fulfillment sau khi đã có SKU, giữ `warehouseId` trong request tồn kho.
2. Thêm `weightGrams` ở thông tin sản phẩm, yêu cầu số nguyên dương; biến thể được để trống để kế thừa hoặc nhập số nguyên dương để ghi đè. Gửi trường này khi tạo/sửa sản phẩm và biến thể; hiển thị lại giá trị từ detail. Không đặt mặc định 200g ở FE.
3. Bỏ nhánh tự tạo kho “Kho tiêu chuẩn Seller Nexus” trong luồng tạo sản phẩm. Khi không có kho, dẫn đến luồng khai báo kho thực; không gửi mã GHN giả. Sản phẩm Draft không tự khai tồn; sau kích hoạt, nhập hàng qua Fulfillment.
4. Thêm lựa chọn “Sản phẩm đấu giá” dẫn tới `POST /api/v1/products/auction` với `categoryId`, `name`, `description`, `brand`, `skuCode?`, `specifications`, `weightGrams > 0`. Response `ProductDto` chỉ bảo đảm `id`, không có `skuId`: đọc detail auction của Catalog để lấy SKU vừa tạo, hoàn thiện ảnh/trạng thái theo API Catalog, rồi mới cho form tạo phiên dùng SKU đó. Không giả định product Draft đã đủ điều kiện mở phiên.

**Nghiệm thu:** payload Catalog không còn kho/số lượng; sản phẩm và biến thể có cân nặng hợp lệ; tồn chỉ đi qua Fulfillment; tạo sản phẩm đấu giá không cần giá biến thể và lấy đúng SKU qua detail.

### Gói 2 — Đấu giá cơ bản và đơn đấu giá

**FE:** `src/features/auction/services/auction.service.ts`, `auction-order.service.ts`, `AuctionPages.tsx`, `AuctionOperations.tsx`, `AuctionOrderPayment.tsx`, `SellerAuctionOrders.tsx`.

1. Đối chiếu lại DTO và trạng thái các màn list/detail/bid/result, phân trang, đồng hồ và `If-Match`. Giữ bảng xếp hạng một bidder một vị trí; bid lại chỉ bị chặn theo quy tắc BE, không tự khóa sau bid đầu tiên.
2. Thay `result()` đang tổng hợp `/result` + `/settlement` và tự tính `hasWinner` bằng type trực tiếp của `GET /api/v1/auctions/{id}/result`: dùng `phase`, `winner`, `settlement`, `myDeposit`, `secondChance`. Với người thua, `winnerId = null` có thể là ẩn danh; dùng `phase`, không hiển thị “chưa có người thắng” chỉ vì ID bị ẩn.
3. Chỉ hiển thị đơn/hạn thanh toán theo `settlement` được BE cho phép xem. Chi tiết đơn lấy `GET /api/v1/auction-orders/{id}`; địa chỉ `PUT .../{id}/shipping`; thanh toán ví `POST .../{id}/pay`; seller accept/reject, buyer confirm-receipt theo status thực. Hiển thị `depositAmount`, `remainingAmount` của result nhưng **không tự trừ cọc ở FE** khi Commerce chưa làm.
4. Kiểm tra route danh sách `GET /api/v1/auction-orders/seller`: Commerce có endpoint nhưng `Gateway/appsettings.json` đang chỉ nhận `{auctionOrderId:guid}`. Đầu việc Gateway là route riêng `/seller`, không thể chữa bằng đổi FE sang GUID. Màn danh sách seller chưa đạt nghiệm thu qua Gateway trước khi sửa route.

**Nghiệm thu:** buyer thắng/thua thấy kết quả đúng quyền; đơn chỉ hiện khi đã tạo; không double pay; seller list qua Gateway; các trạng thái đơn và tiền lấy từ BE.

### Gói 3 — Đặt cọc đấu giá và Second-Chance

**FE:** thêm `auction-deposit.service.ts`, `auction-second-chance.service.ts` và type trong `src/features/auction/types`; cập nhật `AuctionPages.tsx`, `BuyerAuctionOffers.tsx`, màn result/payment; mở rộng màn admin đấu giá và cấu hình.

1. Phòng đấu giá gọi `GET /api/v1/auctions/{id}/deposit-requirement`, `GET /api/v1/auctions/{id}/deposits/me`, và số dư `GET /api/v1/wallets/me`. Hiện số cọc, tỷ lệ, phiên bản chính sách, phần có thể mất, số dư khả dụng. Chỉ khi người dùng xác nhận điều khoản mới gọi `POST /api/v1/auctions/{id}/deposits` với `acceptedPolicyVersion`, `acceptedDepositAmount` và `Idempotency-Key`; giữ cùng key khi retry cùng ý định. Sau phản hồi, đọc lại `/deposits/me`; chỉ mở nút Bid khi `canBid=true`/status `Authorized` và điều kiện phiên đạt. Thiếu tiền hiển thị `shortfall` và đường tới nạp ví.
2. Màn kết quả dùng `phase`, `myDeposit` và `secondChance` từ API 06. Với người được mời, gọi `GET /api/v1/auctions/{id}/second-chance/me`, cho thấy `offerPrice`, `respondBy`, trạng thái và thông báo phải trả đủ giá mời nếu cọc cũ đã nhả. Chuyển hành động trong `BuyerAuctionOffers.tsx` từ `/winner-offers/{offerId}` sang `POST /second-chance/accept` với `acceptedPrice` + `Idempotency-Key`, hoặc `POST /second-chance/decline`. Tải lại offer/result sau phản hồi, ngăn gửi hai lần.
3. Admin thêm chính sách cọc `GET/PUT /api/v1/admin/auction-configs/deposit-policy` (`If-Match` là version hiện tại), danh sách cọc `GET /api/v1/admin/auctions/{id}/deposits`, điểm cần xử lý `needsAttention`; màn vi phạm dùng `GET/POST /api/v1/admin/users/{userId}/auction-violations`. API nội bộ Wallet, Commerce, Catalog và User trong bộ 25 API **không gọi từ FE**.
4. **Gate bắt buộc trước khi bật đặt cọc thật:** WalletService phải có hold/capture/release/get/refund theo contract v0.4 và AuctionService phải gọi đúng route. Hiện `Auction.Infrastructure/Clients/WalletClient.cs` gọi `/api/v1/wallets/deposit-holds`, WalletService không có controller tương ứng; tài liệu v0.4 ghi `/wallets/holds`, nên BE phải thống nhất cả đường dẫn lẫn payload. Thêm gate cho capture/retry, Commerce trừ cọc đúng khi thanh toán, bảo vệ `POST /auction-orders/settlement`, User reset vi phạm. Đây là việc BE tạm hoãn theo quyết định của bạn; FE không thể khắc phục bằng UI.

**Nghiệm thu FE khi BE sẵn sàng:** chưa cọc không bid; cọc đủ thì bid; cọc Pending không bid; lỗi thiếu tiền, 409/422/503 và retry không tạo hai hold; người về nhì nhận/từ chối đúng hạn; kết quả người thua không lộ danh tính người thắng.

### Gói 4 — P2-02 Review và điểm uy tín hai chiều

**FE:** `src/features/commerce/CommerceScreens.tsx`, màn `/buyer/orders/[id]/review`, chi tiết đơn buyer, `src/features/catalog/ProductDetailScreen.tsx`; thêm màn `/seller/reviews` và service review theo owner.

1. Đọc sản phẩm từ các `subOrders[].items` của order detail, xác nhận ID đơn mà Catalog dùng để chứng minh mua hàng. Gửi review sản phẩm bằng `multipart/form-data` tới `POST /api/v1/products/{productId}/reviews`: `orderId`, `rating`, `comment`, `reviewImages` tối đa 5 ảnh. Danh sách và điểm số: `GET /api/v1/products/{id}/reviews`, `/rating-summary`; hiển thị phân trang ở chi tiết sản phẩm.
2. Review đối tác đi qua UserService `POST /api/v1/reviews` với `revieweeId`, `reviewerRole`, `referenceType`, `referenceId`, `rating`, `comment`, `mediaUrls`. Ảnh đối tác upload trước qua `/api/v1/reviews/files/upload`. Buyer đánh giá seller và seller đánh giá buyer trong các đơn hoàn tất; FE lấy ID người được đánh giá từ order, không nhập ID tùy ý. Có trạng thái đã đánh giá, trùng, không đủ điều kiện. Thêm liên kết từ chi tiết đơn.
3. `PUT/DELETE /api/v1/reviews/{id}` của Catalog trùng route UserService trong Gateway hiện tại. Nếu tính năng sửa/xóa review sản phẩm nằm trong phạm vi, ghi đầu việc Gateway định tuyến theo method/path hoặc đổi prefix API; không mở nút sửa/xóa trước khi route thông.

**Nghiệm thu:** review đúng sản phẩm/đơn và đúng đối tác, không gửi được trước hoàn tất, trả 409 trùng được hiển thị rõ; điểm uy tín tải lại từ UserService.

### Gói 5 — P2-03 Ví Seller, rút tiền và Stripe

**FE:** `src/features/wallet/services/wallet.service.ts`, `WalletOperationsScreens.tsx`, `WalletScreen.tsx`, route `/buyer/wallet/top-up`, `/buyer/payment/result`, `/seller/withdrawals`, và staff withdrawals hiện có.

1. Bỏ lời gọi VNPay. `POST /api/v1/wallets/topups/stripe` gửi `{amount}` là VND nguyên từ 10.000 đến 99.999.999, `Idempotency-Key` giữ qua retry cùng request. Nhận `transactionId`, `paymentUrl`, `amount`, `currency`, `status`, `createdAt`; lưu *chỉ* loại giao dịch + ID trong `sessionStorage` theo tab rồi chuyển tới URL BE trả. Trang return/cancel đọc context, gọi `GET /api/v1/wallets/topups/{id}` và cho kiểm tra lại; chỉ `Success` từ BE mới báo tiền vào ví. Không lấy query `checkout=return|cancel` làm kết luận.
2. Form seller rút tiền gọi `POST /api/v1/wallets/withdrawals` với `amount`, `currency: VND`, `bankCode`, `accountNumber`, `accountHolderName`; validate tối thiểu 50.000, tối đa số dư khả dụng, lỗi BE và chống double submit. Response `withdrawalId`, `amount`, `fee`, `status`, `requestedAt`: hiển thị “Đang chờ duyệt” với mã và tải lại số dư. Không gọi `Approved` là đã chuyển khoản.
3. Không dùng giao dịch ví làm lịch sử yêu cầu Pending/Approved/Rejected. WalletService hiện thiếu GET danh sách lệnh rút cho seller/staff; giữ trạng thái vừa tạo trong phiên và để mục lịch sử yêu cầu chờ BE. Màn staff theo UUID hiện tại chưa thể duyệt theo hàng đợi.
4. Direct Stripe checkout cho đơn thường thuộc Commerce: Wallet handover ghi rõ Commerce chưa xác nhận order/đồng bộ thanh toán. Không cho FE gọi trực tiếp Wallet để đi vòng kiểm tra order; ghi thành dependency BE riêng.

**Nghiệm thu:** lỗi tạo Stripe không tự báo thành công; return trễ, cancel và mất session context hiện trung lập; rút vượt số dư bị chặn; trạng thái yêu cầu và bút toán ví tách biệt.

### Gói 6 — P2-05 Khiếu nại, cấm quyền và freeze ví

**FE:** `src/features/commerce/CommerceScreens.tsx` (`BuyerReportsScreen`), màn staff reports/admin penalties hiện có; thêm service report upload.

1. Đổi nút “Gửi báo cáo” sang submit có khóa trong khi gửi. Chỉ chọn ảnh JPG/PNG/WEBP theo quyết định bỏ video, tối đa 5 file và giới hạn theo BE. Upload `FormData(files)` tới `POST /api/v1/reports/files/upload`, nhận URL, rồi `POST /api/v1/users/reports` với `reportedUserId`, `violationType`, `description`, `evidenceUrls`. Báo lỗi đúng bước và cho gửi lại khi upload thành công nhưng tạo report lỗi.
2. Kết nối liên kết “Báo cáo” từ ngữ cảnh đơn/user để điền ID mục tiêu, tránh bắt Buyer chép UUID. Staff/Admin tiếp tục xem, phân xử, áp chế tài theo API hiện có; hiển thị cấm quyền nếu BE trả trạng thái tương ứng. Trạng thái freeze ví chỉ hiển thị khi Wallet trả dữ liệu thật; FE không tự đặt trạng thái frozen.
3. Gate BE: chưa có luồng tranh chấp → đóng băng/mở lại ví; phần này chưa thể nghiệm thu hoàn toàn khi BE bị hoãn.

### Gói 7 — P2-06 Báo cáo và kiểm duyệt sản phẩm

**FE:** `src/features/catalog/ProductDetailScreen.tsx`, `src/features/staff/StaffProductModerationScreen.tsx`, service moderation/report mới hoặc mở rộng service hiện có.

1. Thêm nút Báo cáo sản phẩm ở chi tiết sản phẩm cho vai trò được phép. Form có `reason`, `description` 10–2000 ký tự và 1–5 ảnh (mỗi ảnh tối đa 5 MB), gửi `multipart/form-data` tới `POST /api/v1/products/{id}/reports` với khóa nút và thông báo 409 đã báo cáo.
2. Tách hai hàng đợi ở staff: duyệt sản phẩm thông thường và tố cáo sản phẩm. Hàng tố cáo dùng `GET /api/v1/admin/reports/products` có phân trang/lọc, `PUT /api/v1/admin/reports/products/{reportId}/action` với `BAN_PRODUCT | DISMISS | INVESTIGATE` và `resolutionNote`. Sửa giá trị `SUSPENDED` đang gửi sai thành `SUSPEND` ở hàng duyệt thường; thêm `BAN` chỉ nếu endpoint duyệt thường chấp nhận, không trộn với `BAN_PRODUCT` của report.
3. Gate Gateway: `appsettings.json` hiện route chung `/api/v1/admin/reports/**` sang UserService; route riêng Catalog chỉ xuất hiện trong `appsettings.example.json`. Cần cấu hình runtime định tuyến riêng trước khi công bố hàng tố cáo hoạt động.

### Gói 8 — P2-07 GHN trả hàng và hoàn kho

**FE:** `src/features/seller/SellerScreens.tsx` (`SellerOrderDetailScreen`), `src/features/seller/services/seller-orders.service.ts` hoặc service shipment riêng.

1. Đọc trạng thái shipment bằng `GET /api/v1/shipments/order/{orderId}`. Chỉ hiện xác nhận hàng hoàn khi BE chứng minh kiện đã trả và người bán có quyền; yêu cầu người bán xác nhận đã nhận hàng vật lý. Gửi `POST /api/v1/shipments/orders/{orderId}/confirm-return` là alias trong Fulfillment đi qua route `/api/v1/shipments/**` hiện có; hoặc thêm route Gateway cho alias `/api/v1/seller/orders/{id}/confirm-return`. Kiểm tra ID shipment dùng `orderId` hay `subOrderId` trước khi nối.
2. Sau phản hồi `STOCK_RESTORED`, tải lại shipment, đơn và tồn; hiển thị `totalRestored`, không tự tăng số tồn ở FE. Không cho gửi lặp từ UI.
3. Gate BE bắt buộc: `ConfirmReturnAsync` hiện không kiểm tra đã Returned trước khi cộng tồn, nên lặp request có thể cộng tồn nhiều lần; đồng thời kiểm quyền bằng `shipment.Warehouse.SellerId`, có thể từ chối đơn ở kho chung. BE phải sửa idempotency và quyền seller/đơn trước khi bật nút production. FE khóa nút không thay thế kiểm tra này.

## Báo cáo hạng mục tạm hoãn và phụ thuộc BE

| Hạng mục | Trạng thái kế hoạch | Điều kiện để quay lại |
| --- | --- | --- |
| P2-01 Voucher Sàn & Shop | Tạm hoãn toàn bộ FE/BE | Commerce có CRUD, apply/quote/reserve voucher và contract tính giảm giá. |
| P2-04 Sổ cái kép & Bill lệch | Tạm hoãn; không gọi màn điều chỉnh số dư hiện có là sổ cái kép | BE có ledger kép, reconciliation, discrepancy APIs; sửa lệch `walletId`/`userId` trước khi dùng màn điều chỉnh. |
| P2-08 Config động, Audit Log, System Health | Tạm hoãn phần còn lại, kể cả `/admin/audit-log` dù báo cáo cũ xếp vào “Quick Wins” | Khi mở lại, xác nhận route LogService và API health tổng hợp; giữ `/admin/configs` đang có. |
| Cọc đấu giá phía BE | Tạm hoãn theo chỉ đạo | Wallet holds v0.4, Auction capture/retry, Commerce auth/khấu trừ cọc, User reset vi phạm và contract route thống nhất. |
| Gateway ngoài FE | Đầu việc phụ thuộc, không sửa trong gói FE | Route seller auction orders, review Catalog, product reports, confirm-return nếu dùng alias seller; kiểm tra cấu hình đang deploy. |
| Freeze ví khi tranh chấp | Phụ thuộc BE | Có trạng thái và API freeze/unfreeze theo quyền; FE chỉ hiển thị dữ liệu thật. |
| Danh sách yêu cầu rút | Phụ thuộc WalletService | `GET` của seller và hàng đợi staff/admin với phân trang/trạng thái/owner check. |

## Kiểm tra trước khi kết luận hoàn thành

- Với từng gói: contract test cho URL, method, body, headers và response; thử 401/403/404/409/422/503, dữ liệu rỗng, gửi lặp và quyền buyer/seller/staff/admin.
- E2E tối thiểu: tạo sản phẩm thường/đấu giá và nhập kho; bid cọc đủ/thiếu; trả lời second-chance; kết quả thắng/thua; tạo/chi trả đơn; review hai chiều; Stripe return/cancel; rút Pending; report ảnh; trả hàng và xác nhận một lần. Các ca phụ thuộc BE được đánh dấu blocked, không giả lập là pass.
- Kiểm tra desktop/mobile, bàn phím, focus, trạng thái chờ, số tiền dài; chạy `npm run lint`, `npm run typecheck`, `npm run build` và test có liên quan. Kiểm tra Gateway runtime và smoke test với BE thật trước khi mở CTA tài chính hoặc hoàn kho.

## Stop conditions

- Dừng việc mở CTA cọc khi Wallet hold chưa thông; dừng `confirm-return` khi BE chưa bảo đảm idempotency/owner.
- Không tự sửa dữ liệu tiền ở FE để bù lỗi Commerce, không dùng route User review cho thao tác Catalog review, và không gọi trực tiếp Wallet direct checkout để vượt Commerce.
- Nếu contract runtime khác báo cáo hoặc `appsettings.example.json`, cập nhật mapping từ code đang deploy trước khi triển khai UI tiếp.
