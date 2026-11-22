/**
 * One dictionary from back-end error codes to what the user reads.
 *
 * Rules the dictionary keeps:
 *  - Codes are the real `errorCode` values the services throw (checked against the Commerce, Auction, Wallet, Fulfillment and User code).
 *  - A message never says money was or was not taken unless the back end guarantees it for that code in that place.
 *    The only such claims are marked `byScope` below (order placement, where stock is reserved before the wallet is charged).
 *  - A write that ends in a timeout, a dropped connection or a 5xx without a code has an UNKNOWN outcome. The user is told so
 *    and sent to check the order and the wallet, never "nothing was charged".
 *  - Raw back-end text never reaches the user. An unknown code gets a general message plus the code and trace id for support.
 */

export type ErrorOperation = "read" | "write";

/** Where the failing call happened, for the few codes whose meaning depends on it. */
export type ErrorScope = "place-order";

/** `definite`: the server answered and refused. `unknown-outcome`: a write whose result we cannot know. `permission`: role or switch. */
export type ErrorKind = "definite" | "unknown-outcome" | "permission" | "unavailable";

export type DescribedError = {
  message: string;
  /** What to do next, when there is a clear next step. */
  hint?: string;
  kind: ErrorKind;
  code?: string;
  status?: number;
  traceId?: string;
};

type Entry = {
  message: string;
  hint?: string;
  kind?: ErrorKind;
  byScope?: Partial<Record<ErrorScope, { message: string; hint?: string; kind?: ErrorKind }>>;
};

const TOP_UP = "Nạp thêm tiền vào Ví Nexus rồi thử lại.";
const RELOAD = "Tải lại trang để lấy dữ liệu mới nhất rồi thử lại.";

export const ERROR_DICTIONARY: Record<string, Entry> = {
  // ---- account and permission
  ACCOUNT_BANNED: { message: "Tài khoản của bạn đã bị khóa.", hint: "Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.", kind: "permission" },
  USER_BANNED: { message: "Tài khoản của bạn đã bị khóa.", hint: "Liên hệ hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.", kind: "permission" },
  ACCOUNT_LOCKED_TEMPORARY: { message: "Tài khoản đang bị khóa tạm thời.", hint: "Thử lại sau khi hết thời gian khóa.", kind: "permission" },
  ACCOUNT_RESTRICTED: { message: "Tài khoản đang bị hạn chế một số thao tác.", kind: "permission" },
  ACCOUNT_NOT_VERIFIED: { message: "Tài khoản chưa được xác minh.", hint: "Hoàn tất xác minh tài khoản rồi thử lại.", kind: "permission" },
  ACCOUNT_UNVERIFIED: { message: "Tài khoản chưa được xác minh.", hint: "Hoàn tất xác minh tài khoản rồi thử lại.", kind: "permission" },
  ACCOUNT_INACTIVE: { message: "Tài khoản hiện không hoạt động.", kind: "permission" },
  ACCOUNT_TERMS_VIOLATION: { message: "Tài khoản bị hạn chế do vi phạm điều khoản sử dụng.", kind: "permission" },
  ROLE_NOT_ALLOWED: { message: "Vai trò của bạn không được phép thực hiện thao tác này.", kind: "permission" },
  FORBIDDEN: { message: "Bạn không có quyền thực hiện thao tác này.", kind: "permission" },
  FEATURE_DISABLED: { message: "Chức năng này chưa được bật ở môi trường hiện tại.", kind: "unavailable" },
  NOT_FOUND: { message: "Không tìm thấy dữ liệu yêu cầu.", kind: "definite" },

  // ---- request integrity
  CONCURRENT_UPDATE: { message: "Dữ liệu vừa được thay đổi bởi một thao tác khác.", hint: RELOAD },
  IDEMPOTENCY_KEY_REUSED: { message: "Yêu cầu này trùng mã với một yêu cầu khác nội dung.", hint: RELOAD },
  IDEMPOTENCY_CONFLICT: { message: "Yêu cầu này đang được xử lý hoặc xung đột với một yêu cầu trước.", hint: "Chờ một lát rồi kiểm tra lại trước khi thử lại." },

  // ---- wallet and balance
  INSUFFICIENT_AVAILABLE_BALANCE: { message: "Số dư khả dụng trong ví không đủ.", hint: TOP_UP },
  INSUFFICIENT_BALANCE: { message: "Số dư khả dụng trong ví không đủ.", hint: TOP_UP },
  INSUFFICIENT_WALLET_BALANCE: { message: "Số dư khả dụng trong ví không đủ.", hint: TOP_UP },
  WALLET_NOT_FOUND: { message: "Người nhận chưa có ví Nexus hoặc mã người nhận không đúng." },
  BUSINESS_RULE_VIOLATION: { message: "Thao tác không hợp lệ theo quy định (ví dụ chuyển tiền cho chính mình)." },
  WITHDRAWAL_NOT_FOUND: { message: "Không tìm thấy yêu cầu rút tiền." },
  WITHDRAWAL_INVALID_TRANSITION: { message: "Yêu cầu rút tiền không còn ở trạng thái cho phép thao tác này.", hint: RELOAD },

  // ---- checkout and orders
  QUOTE_NOT_FOUND: { message: "Báo giá không còn tồn tại.", hint: "Quay lại giỏ hàng để lấy báo giá mới." },
  QUOTE_EXPIRED: {
    message: "Báo giá đã hết hạn hoặc đang được xử lý.",
    hint: "Quay lại giỏ hàng để lấy báo giá mới.",
    byScope: {
      // The back end removes the quote as soon as it starts processing an order, and answers with this same code for a quote
      // that is expired, invalid or "currently being processed". It does not prove that no order was created.
      "place-order": {
        message: "Chưa xác định được kết quả đặt đơn.",
        hint: "Hãy kiểm tra Đơn mua và Ví của bạn trước khi làm gì khác. Đừng đặt lại cho tới khi chắc chắn.",
        kind: "unknown-outcome",
      },
    },
  },
  INSUFFICIENT_STOCK: {
    message: "Không đủ hàng cho số lượng đã chọn.",
    hint: "Quay lại giỏ hàng để chỉnh số lượng.",
    // The wallet is charged after stock is reserved, so a refusal here never took money. Whether an unpaid order record was left
    // behind is NOT claimed: with vouchers applied the back end may keep it (see the WP-1 notes), so the message stays silent on it.
    byScope: { "place-order": { message: "Không đủ hàng cho số lượng đã chọn. Ví của bạn chưa bị trừ tiền.", hint: "Quay lại giỏ hàng để chỉnh số lượng." } },
  },
  PRICE_CHANGED: { message: "Giá của một sản phẩm trong đơn đã tăng. Giá trong giỏ hàng đã được cập nhật.", hint: "Xem lại đơn hàng rồi xác nhận lại." },
  INSUFFICIENT_INVENTORY: { message: "Không đủ hàng cho số lượng đã chọn.", hint: "Quay lại giỏ hàng để chỉnh số lượng." },
  FULFILLMENT_UNAVAILABLE: {
    message: "Hệ thống kho tạm thời không phản hồi.",
    hint: "Thử lại sau ít phút.",
    kind: "unavailable",
    byScope: { "place-order": { message: "Hệ thống kho tạm thời không phản hồi. Ví của bạn chưa bị trừ tiền.", hint: "Lấy báo giá mới và thử lại sau ít phút.", kind: "unavailable" } },
  },
  SELLER_WAREHOUSE_MISSING: { message: "Cửa hàng này chưa có kho gửi hàng nên chưa thể nhận đơn.", hint: "Bỏ sản phẩm của cửa hàng này khỏi đơn hoặc thử lại sau." },
  SELLER_WAREHOUSE_INCOMPLETE: { message: "Kho của cửa hàng này thiếu thông tin quận, phường gửi hàng nên chưa thể nhận đơn.", hint: "Bỏ sản phẩm của cửa hàng này khỏi đơn hoặc thử lại sau." },

  SYSTEM_VOUCHER_NOT_ALLOWED_FOR_COD: { message: "Mã giảm giá của sàn không dùng được khi thanh toán khi nhận hàng (COD).", hint: "Bỏ mã của sàn hoặc chọn thanh toán bằng ví." },
  ORDER_NOT_FOUND: { message: "Không tìm thấy đơn hàng." },
  SUB_ORDER_NOT_FOUND: { message: "Không tìm thấy đơn của gian hàng." },
  ORDER_EMPTY: { message: "Đơn hàng không còn sản phẩm nào đang hoạt động." },
  INVALID_STATUS: { message: "Đơn hàng không ở trạng thái cho phép thao tác này.", hint: RELOAD },
  ORDER_PAYMENT_DEADLINE_EXPIRED: { message: "Đơn hàng đã quá hạn thanh toán.", hint: "Đặt lại đơn mới từ giỏ hàng." },
  INVALID_PAYMENT_METHOD: { message: "Đơn thanh toán khi nhận hàng (COD) không thanh toán online được." },
  WALLET_PAYMENT_FAILED: { message: "Ví chưa thanh toán được đơn hàng này.", hint: "Kiểm tra số dư ví rồi thử lại.", kind: "unavailable" },
  CANNOT_CHANGE_ADDRESS_AFTER_SHIPPING: { message: "Không thể đổi địa chỉ vì đơn hàng đã được giao đi hoặc đã hoàn tất." },
  SHIPPING_FEE_INCREASED: { message: "Phí giao hàng tới địa chỉ mới cao hơn số tiền đã thanh toán.", hint: "Hủy đơn và đặt lại với địa chỉ mới." },

  // ---- vouchers and subsidy
  VOUCHER_NOT_FOUND: { message: "Không tìm thấy mã giảm giá." },
  VOUCHER_EXPIRED: { message: "Mã giảm giá đã hết hạn." },
  VOUCHER_OUT_OF_STOCK: { message: "Mã giảm giá đã hết lượt sử dụng." },
  VOUCHER_USAGE_LIMIT_EXCEEDED: { message: "Mã giảm giá đã hết lượt sử dụng." },
  VOUCHER_USER_LIMIT_EXCEEDED: { message: "Bạn đã dùng hết số lượt cho phép của mã này." },
  VOUCHER_STACKING_CONFLICT: { message: "Mã này không dùng chung được với mã khác trong cùng đơn." },
  VOUCHER_NOT_APPLICABLE: { message: "Mã giảm giá không áp dụng được cho đơn này." },
  VOUCHER_SKU_AUCTION_NOT_ALLOWED: { message: "Mã giảm giá không áp dụng cho sản phẩm hoặc đơn đấu giá này." },
  VOUCHER_SELLER_SKU_FORBIDDEN: { message: "Người bán không được áp mã này cho sản phẩm đã chọn." },
  VOUCHER_ALREADY_IN_USE: { message: "Mã giảm giá đang được dùng cho một đơn khác." },
  VOUCHER_USAGE_LIMIT_CONFLICT: { message: "Mã giảm giá vừa hết lượt do có người khác dùng.", hint: "Thử lại hoặc chọn mã khác." },
  SHOP_MULTIPLE_VOUCHERS_NOT_ALLOWED: { message: "Mỗi gian hàng chỉ được dùng một mã giảm giá.", hint: "Bỏ bớt mã của cùng một gian hàng." },
  DISCOUNT_CODE_ALREADY_EXISTS: { message: "Mã giảm giá này đã tồn tại.", hint: "Chọn một mã khác." },
  CATALOG_SKU_NOT_FOUND: { message: "Không tìm thấy sản phẩm (SKU) đã chọn." },
  CATALOG_SKU_INACTIVE: { message: "Sản phẩm (SKU) này chưa hoạt động." },
  VAL_INVALID_INPUT: { message: "Thông tin nhập chưa hợp lệ.", hint: "Kiểm tra lại các ô đã nhập." },
  VOUCHER_NO_LONGER_VALID: { message: "Mã giảm giá không còn áp dụng được cho đơn này.", hint: "Lấy báo giá mới để xem giá sau khi bỏ mã." },
  VOUCHER_BUDGET_EXHAUSTED: { message: "Ngân sách của chương trình giảm giá này đã hết.", hint: "Bỏ mã rồi lấy báo giá mới." },
  SUBSIDY_UNAVAILABLE: { message: "Chương trình trợ giá của mã này hiện không khả dụng.", hint: "Bỏ mã rồi lấy báo giá mới." },
  SUBSIDY_BUDGET_UNAVAILABLE: { message: "Ngân sách trợ giá hiện không khả dụng.", hint: "Bỏ mã rồi lấy báo giá mới." },
  SUBSIDY_BUDGET_EXHAUSTED: { message: "Ngân sách trợ giá đã hết.", hint: "Bỏ mã rồi lấy báo giá mới." },
  SUBSIDY_DAILY_LIMIT_EXCEEDED: { message: "Ngân sách trợ giá hôm nay đã đạt giới hạn.", hint: "Thử lại vào ngày hôm sau hoặc bỏ mã." },
  SUBSIDY_PER_ORDER_CAP_EXCEEDED: { message: "Mức trợ giá vượt giới hạn cho mỗi đơn." },
  SUBSIDY_APPROVER_MUST_DIFFER: { message: "Người duyệt ngân sách phải khác người tạo ngân sách.", hint: "Nhờ một quản trị viên khác duyệt.", kind: "permission" },
  SUBSIDY_ACTIVE_BUDGET_EXISTS: { message: "Đã có một ngân sách trợ giá đang hoạt động." },
  SUBSIDY_BUDGET_NOT_FOUND: { message: "Không tìm thấy ngân sách trợ giá." },
  SUBSIDY_BUDGET_NOT_PENDING: { message: "Ngân sách này không còn ở trạng thái chờ duyệt.", hint: RELOAD },
  SUBSIDY_BUDGET_NOT_ACTIVE: { message: "Ngân sách này không còn hoạt động.", hint: RELOAD },
  SUBSIDY_LIMITS_INVALID: { message: "Giới hạn ngân sách không hợp lệ.", hint: "Kiểm tra lại tổng, mức mỗi ngày và mức mỗi đơn." },

  // ---- refunds
  REFUND_NOT_FOUND: { message: "Không tìm thấy yêu cầu hoàn tiền." },
  REFUND_NOT_ALLOWED: { message: "Đơn này không thể hoàn tiền ở trạng thái hiện tại." },
  REFUND_NOT_APPLICABLE: { message: "Đơn này không áp dụng hoàn tiền." },
  REFUND_REQUEST_ALREADY_EXISTS: { message: "Đơn này đã có một yêu cầu hoàn tiền." },
  REFUND_CONFLICT: { message: "Yêu cầu hoàn tiền xung đột với một thao tác khác.", hint: RELOAD },
  REFUND_NOT_RETRYABLE: { message: "Yêu cầu hoàn tiền này không thể thử lại." },
  REFUND_RETRYING: { message: "Hoàn tiền đang được thử lại.", hint: "Kiểm tra lại trạng thái sau ít phút." },
  REFUND_EXCEEDS_PAYMENT: { message: "Số tiền hoàn vượt quá số đã thanh toán." },

  // ---- auction
  BIDDER_RESTRICTED: { message: "Bạn đang bị hạn chế tham gia đấu giá.", hint: "Xem mục Uy tín của tôi để biết lý do.", kind: "permission" },
  AUCTION_MIN_REPUTATION_BID: { message: "Điểm uy tín của bạn chưa đủ để đặt giá ở phiên này.", kind: "permission" },
  AUCTION_MIN_REPUTATION_CREATE: { message: "Điểm uy tín của bạn chưa đủ để tạo phiên đấu giá.", kind: "permission" },
  DEPOSIT_REQUIRED: { message: "Bạn cần đặt cọc trước khi đặt giá ở phiên này." },
  DEPOSIT_HOLD_NOT_ACTIVE: { message: "Khoản cọc chưa được giữ trong ví.", hint: TOP_UP },
  DEPOSIT_RELEASE_PENDING: { message: "Khoản giữ tiền trước đó đang được giải phóng.", hint: "Thử lại sau ít phút." },
  DEPOSIT_TERMS_CHANGED: { message: "Điều kiện đặt cọc vừa thay đổi.", hint: RELOAD },
  AUCTION_NOT_FOUND: { message: "Không tìm thấy phiên đấu giá." },
  AUCTION_NOT_RUNNING: { message: "Phiên đấu giá không còn diễn ra." },
  AUCTION_ENDED: { message: "Phiên đấu giá đã kết thúc." },
  AUCTION_ENDED_BUY_NOW: { message: "Phiên đã kết thúc vì có người Mua ngay." },
  AUCTION_CANCELLED: { message: "Phiên đấu giá đã bị hủy." },
  AUCTION_HAS_BIDS: { message: "Phiên đã có lượt đặt giá nên không thể thực hiện thao tác này." },
  AUCTION_NOT_EDITABLE: { message: "Phiên đấu giá không còn chỉnh sửa được." },
  AUCTION_FORCE_CANCEL_REQUIRED: {
    message: "Sản phẩm đang nằm trong một phiên đấu giá.",
    hint: "Hủy phiên đấu giá trước, rồi mới cấm sản phẩm.",
  },
  NOT_AWAITING_SELLER_APPROVAL: { message: "Phiên này không còn chờ bạn duyệt giá dưới sàn.", hint: RELOAD },
  SELLER_APPROVAL_EXPIRED: { message: "Đã quá hạn 12 giờ để phản hồi, hệ thống đã xử lý phiên này." },
  AUCTION_NOT_AWAITING_SETTLEMENT: { message: "Phiên này chưa ở bước chờ chốt kết quả.", hint: RELOAD },
  VAL_INVALID_PRICE: { message: "Giá nhập không hợp lệ.", hint: "Kiểm tra giá khởi điểm, giá sàn và giá mua ngay (không âm, tối đa 2 chữ số thập phân)." },
  INVALID_PRICE_RELATION: { message: "Quan hệ giữa các mức giá chưa đúng.", hint: "Giá sàn phải từ giá khởi điểm trở lên; giá mua ngay phải lớn hơn giá sàn (hoặc giá khởi điểm nếu không có giá sàn). Khi sửa phiên, giá đã lưu trước đó vẫn được kiểm tra cùng giá mới." },
  SELLER_CANNOT_BID_OWN_AUCTION: { message: "Bạn không thể đặt giá hoặc mua phiên của chính mình." },
  WALLET_FROZEN: { message: "Ví Nexus của bạn đang bị tạm khóa.", hint: "Liên hệ hỗ trợ.", kind: "permission" },
  BUY_NOW_NOT_CONFIGURED: { message: "Phiên này không có giá Mua ngay." },
  BUY_NOW_NOT_AVAILABLE: { message: "Mua ngay không còn khả dụng vì giá hiện tại đã đạt ngưỡng." },
  BUY_NOW_HOLD_FAILED: { message: "Không khóa được phần tiền hàng còn lại trong ví.", hint: TOP_UP },
  RESERVE_NOT_MET: { message: "Giá cao nhất chưa đạt giá sàn của người bán." },
  RESERVE_PRICE_RESTRICTED: { message: "Người bán đang bị hạn chế đặt giá sàn.", kind: "permission" },

  // ---- ledger and reconciliation
  LEDGER_SETTINGS_VERSION_CONFLICT: { message: "Cấu hình sổ bóng đã bị người khác thay đổi.", hint: "Tải lại để lấy phiên bản mới rồi thử lại." },
  RECONCILIATION_RUN_NOT_FOUND: { message: "Không tìm thấy lần đối soát." },
  RECONCILIATION_FINDING_NOT_FOUND: { message: "Không tìm thấy phát hiện đối soát." },
};

const GENERIC_READ: Pick<DescribedError, "message" | "hint"> = {
  message: "Không tải được dữ liệu.",
  hint: "Kiểm tra kết nối rồi thử lại.",
};
const GENERIC_UNKNOWN_WRITE: Pick<DescribedError, "message" | "hint"> = {
  message: "Chưa xác định được kết quả của thao tác.",
  hint: "Hãy kiểm tra lại dữ liệu liên quan (đơn hàng, ví) trước khi thử lại.",
};
const GENERIC_REFUSED: Pick<DescribedError, "message" | "hint"> = {
  message: "Thao tác không thực hiện được.",
  hint: "Thử lại sau. Nếu lỗi lặp lại, gửi mã tham chiếu bên dưới cho bộ phận hỗ trợ.",
};

type ErrorLike = { status?: number; errorCode?: string; traceId?: string };

function asErrorLike(cause: unknown): ErrorLike {
  if (cause && typeof cause === "object") {
    const value = cause as Record<string, unknown>;
    return {
      status: typeof value.status === "number" ? value.status : undefined,
      errorCode: typeof value.errorCode === "string" ? value.errorCode : undefined,
      traceId: typeof value.traceId === "string" ? value.traceId : undefined,
    };
  }
  return {};
}

/** True when the server did not give a definite answer: no status (network), 408, 429 or any 5xx. */
export function isUncertainStatus(status: number | undefined): boolean {
  return status === undefined || status === 408 || status === 429 || status >= 500;
}

/**
 * Turns any thrown value into text for the user. Never returns the back end's own message.
 * `write` operations that end uncertainly report an unknown outcome instead of guessing.
 */
export function describeError(cause: unknown, options: { operation?: ErrorOperation; scope?: ErrorScope } = {}): DescribedError {
  const { operation = "read", scope } = options;
  const { status, errorCode, traceId } = asErrorLike(cause);
  const code = errorCode?.trim().toUpperCase() || undefined;
  const base = { code, status, traceId };

  const entry = code ? ERROR_DICTIONARY[code] : undefined;
  if (entry) {
    const scoped = scope ? entry.byScope?.[scope] : undefined;
    const chosen = scoped ?? entry;
    return { ...base, message: chosen.message, hint: chosen.hint ?? entry.hint, kind: chosen.kind ?? entry.kind ?? "definite" };
  }

  if (status === 401) return { ...base, message: "Phiên đăng nhập đã hết hạn.", hint: "Đăng nhập lại rồi thử lại.", kind: "permission" };
  if (status === 403) return { ...base, message: "Bạn không có quyền thực hiện thao tác này.", kind: "permission" };
  if (status === 404) return { ...base, message: "Không tìm thấy dữ liệu yêu cầu.", kind: "definite" };

  if (isUncertainStatus(status)) {
    return operation === "write"
      ? { ...base, ...GENERIC_UNKNOWN_WRITE, kind: "unknown-outcome" }
      : { ...base, ...GENERIC_READ, kind: "unavailable" };
  }
  return { ...base, ...GENERIC_REFUSED, kind: "definite" };
}

/** One line for toasts and inline errors. */
export function formatError(described: DescribedError): string {
  return described.hint ? `${described.message} ${described.hint}` : described.message;
}
