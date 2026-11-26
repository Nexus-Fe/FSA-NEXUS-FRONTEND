import type { AuctionStatus } from "./types";
import type { AuctionSummary, MyDepositItem, MyWatchlistItem, PagedData, Pagination } from "./types";

const statusLabels = {
  ALL: "Tất cả",
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  SCHEDULED: "Sắp diễn ra",
  RUNNING: "Đang diễn ra",
  ENDED: "Đã kết thúc",
  SETTLED: "Đã hoàn tất",
  FAILED: "Không thành công",
  CANCELLED: "Đã hủy",
} satisfies Record<AuctionStatus | "ALL", string>;

export function normalizeAuctionStatus(status: unknown): AuctionStatus | "ALL" | "" {
  if (typeof status !== "string") return "";
  const raw = status.trim().toUpperCase();
  const normalized = raw === "PENDINGAPPROVAL" ? "PENDING_APPROVAL" : raw;
  return Object.prototype.hasOwnProperty.call(statusLabels, normalized)
    ? normalized as AuctionStatus | "ALL"
    : "";
}

export function isEditableBeforeStart(status: unknown): boolean {
  const normalized = normalizeAuctionStatus(status);
  return normalized === "PENDING_APPROVAL" || normalized === "SCHEDULED";
}

export function statusLabel(status: unknown): string {
  const normalized = normalizeAuctionStatus(status);
  return normalized ? statusLabels[normalized] : "Không rõ trạng thái";
}

export function auctionStatusTone(status: unknown): "sky" | "green" | "amber" | "slate" | "red" {
  const normalized = normalizeAuctionStatus(status);
  switch (normalized) {
    case "RUNNING":
      return "green"; // Đang diễn ra: Xanh lá
    case "PENDING_APPROVAL":
      return "amber"; // Chờ duyệt: Vàng cam
    case "FAILED":
    case "CANCELLED":
      return "red"; // Hủy hoặc Không thành công: Màu đỏ
    case "SCHEDULED":
    case "SETTLED":
      return "sky"; // Sắp diễn ra & Hoàn tất: Màu xanh chủ đề
    case "ENDED":
    case "DRAFT":
    default:
      return "slate"; // Đã kết thúc & Nháp: Xám trung tính
  }
}

const invalidList = (detail: string): never => {
  throw new Error(`Dữ liệu danh sách phiên đấu giá không hợp lệ (${detail}). Hãy tải lại danh sách; nếu vẫn lỗi, liên hệ hỗ trợ.`);
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown): value is string | null => value === null || typeof value === "string";
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));

export function parseAuctionList(data: unknown): PagedData<AuctionSummary> {
  if (!record(data)) return invalidList("thiếu danh sách hoặc phân trang");
  if (!Array.isArray(data.items)) return invalidList("thiếu danh sách hoặc phân trang");
  if (!record(data.pagination)) return invalidList("thiếu danh sách hoặc phân trang");
  const pagination = data.pagination;
  if (!count(pagination.pageIndex) || !count(pagination.pageSize) || !count(pagination.totalCount) ||
    !count(pagination.totalPages) || typeof pagination.hasPreviousPage !== "boolean" ||
    typeof pagination.hasNextPage !== "boolean") return invalidList("phân trang sai định dạng");

  const items = data.items.map((item: unknown, index: number): AuctionSummary => {
    const row = index + 1;
    if (!record(item)) return invalidList(`dòng ${row} không phải phiên đấu giá`);
    if (!text(item.auctionId)) return invalidList(`dòng ${row} thiếu mã phiên auctionId`);
    const status = normalizeAuctionStatus(item.status);
    if (!status || status === "ALL") return invalidList(`dòng ${row} thiếu hoặc sai trạng thái status`);
    if (!text(item.productId) || !text(item.sellerId) || !nullableText(item.skuId) ||
      !nullableText(item.productName) || (item.primaryImageUrl !== undefined && !nullableText(item.primaryImageUrl)) ||
      !amount(item.startPriceAmount) || (item.currentPriceAmount !== null && !amount(item.currentPriceAmount)) ||
      !count(item.bidCount) || !date(item.scheduledStartAt) || !date(item.scheduledEndAt) ||
      !date(item.createdAt)) return invalidList(`dòng ${row} thiếu hoặc sai thông tin phiên`);
    return {
      auctionId: item.auctionId,
      productId: item.productId,
      skuId: item.skuId,
      sellerId: item.sellerId,
      productName: item.productName,
      primaryImageUrl: item.primaryImageUrl ?? null,
      status,
      startPriceAmount: item.startPriceAmount,
      currentPriceAmount: item.currentPriceAmount,
      bidCount: item.bidCount,
      scheduledStartAt: item.scheduledStartAt,
      scheduledEndAt: item.scheduledEndAt,
      createdAt: item.createdAt,
      // Optional: a server without Buy Now or reserve price simply does not send these.
      ...(typeof item.buyNowPriceAmount === "number" && amount(item.buyNowPriceAmount) ? { buyNowPriceAmount: item.buyNowPriceAmount } : {}),
      ...(typeof item.hasReservePrice === "boolean" ? { hasReservePrice: item.hasReservePrice } : {}),
      ...(typeof item.isReserveMet === "boolean" ? { isReserveMet: item.isReserveMet } : {}),
      ...(typeof item.buyNowAvailable === "boolean" ? { buyNowAvailable: item.buyNowAvailable } : {}),
    };
  });

  return {
    items,
    pagination: {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      totalCount: pagination.totalCount,
      totalPages: pagination.totalPages,
      hasPreviousPage: pagination.hasPreviousPage,
      hasNextPage: pagination.hasNextPage,
    } satisfies Pagination,
  };
}

function pagedItems<T>(data: unknown, name: string, parseRow: (row: Record<string, unknown>, index: number) => T): PagedData<T> {
  const fail = (detail: string): never => { throw new Error(`Dữ liệu ${name} không hợp lệ (${detail}). Hãy tải lại; nếu vẫn lỗi, liên hệ hỗ trợ.`); };
  if (!record(data) || !Array.isArray(data.items) || !record(data.pagination)) return fail("thiếu danh sách hoặc phân trang");
  const p = data.pagination;
  if (!count(p.pageIndex) || !count(p.pageSize) || !count(p.totalCount) || !count(p.totalPages) || typeof p.hasPreviousPage !== "boolean" || typeof p.hasNextPage !== "boolean") return fail("phân trang sai định dạng");
  const items = data.items.map((row: unknown, index: number) => (record(row) ? parseRow(row, index + 1) : fail(`dòng ${index + 1} sai định dạng`)));
  return { items, pagination: { pageIndex: p.pageIndex, pageSize: p.pageSize, totalCount: p.totalCount, totalPages: p.totalPages, hasPreviousPage: p.hasPreviousPage, hasNextPage: p.hasNextPage } };
}

/** The deposits of the signed-in buyer (`GET /me/deposits`). */
export function parseMyDeposits(data: unknown): PagedData<MyDepositItem> {
  return pagedItems(data, "danh sách cọc", (row, line) => {
    if (!text(row.depositId) || !text(row.auctionId) || typeof row.auctionTitle !== "string" || !amount(row.amount) ||
      typeof row.ratePercent !== "number" || !text(row.status) || !date(row.createdAt)) {
      throw new Error(`Dữ liệu danh sách cọc không hợp lệ (dòng ${line} thiếu thông tin). Hãy tải lại; nếu vẫn lỗi, liên hệ hỗ trợ.`);
    }
    const when = (value: unknown) => (typeof value === "string" ? value : null);
    return {
      depositId: row.depositId, auctionId: row.auctionId, auctionTitle: row.auctionTitle,
      auctionStatus: typeof row.auctionStatus === "string" ? row.auctionStatus : null,
      amount: row.amount, ratePercent: row.ratePercent, status: row.status,
      capturePurpose: typeof row.capturePurpose === "string" ? row.capturePurpose : null,
      policyVersion: typeof row.policyVersion === "number" ? row.policyVersion : 0,
      authorizedAt: when(row.authorizedAt), releasedAt: when(row.releasedAt), capturedAt: when(row.capturedAt), createdAt: row.createdAt,
    };
  });
}

/** The auctions the signed-in buyer watches (`GET /me/watchlist`). */
export function parseMyWatchlist(data: unknown): PagedData<MyWatchlistItem> {
  return pagedItems(data, "danh sách theo dõi", (row, line) => {
    if (!text(row.auctionId) || !text(row.productId) || !text(row.sellerId) || !text(row.status) || !amount(row.startPriceAmount) ||
      (row.currentPriceAmount !== null && row.currentPriceAmount !== undefined && !amount(row.currentPriceAmount)) ||
      !count(row.bidCount) || typeof row.notifyOnNewBid !== "boolean" || !date(row.scheduledStartAt) || !date(row.scheduledEndAt) || !date(row.watchedAt)) {
      throw new Error(`Dữ liệu danh sách theo dõi không hợp lệ (dòng ${line} thiếu thông tin). Hãy tải lại; nếu vẫn lỗi, liên hệ hỗ trợ.`);
    }
    return {
      auctionId: row.auctionId, productId: row.productId, skuId: typeof row.skuId === "string" ? row.skuId : null, sellerId: row.sellerId,
      productName: typeof row.productName === "string" ? row.productName : null,
      primaryImageUrl: typeof row.primaryImageUrl === "string" ? row.primaryImageUrl : null,
      status: row.status, startPriceAmount: row.startPriceAmount, currentPriceAmount: typeof row.currentPriceAmount === "number" ? row.currentPriceAmount : null,
      bidCount: row.bidCount, notifyOnNewBid: row.notifyOnNewBid, scheduledStartAt: row.scheduledStartAt, scheduledEndAt: row.scheduledEndAt, watchedAt: row.watchedAt,
    };
  });
}
