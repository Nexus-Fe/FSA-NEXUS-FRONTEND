import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { SellerAuctionPricing, BuyNowResponse, MyDepositItem, MyWatchlistItem, ReserveApprovalResponse, SellerReserveStatus, WatchState, AuctionDetail, AuctionResult, AuctionSaga, AuctionStatus, AuctionSummary, BidItem, BidRequest, CreateAuctionReportRequest, CreateAuctionReportResponse, CreateAuctionRequest, DepositRequirement, MyAuctionDeposit, MyBidItem, MySecondChanceOffer, PagedData, PlaceBidResponse, UpdateAuctionRequest, WinnerOffer } from "../types";
import { parseAuctionList, parseMyDeposits, parseMyWatchlist } from "../contract";

const idPath = (id: string) => encodeURIComponent(id);
const envelope = <T>(data: T): ApiResponse<T> => ({ success: true, statusCode: 200, data });
const query = (page: number, pageSize: number, status?: AuctionStatus | "ALL") => `?page=${page}&pageSize=${pageSize}${status && status !== "ALL" ? `&status=${status}` : ""}`;
export type AuctionSettlementRow = { auctionId: string; productTitle: string; finalPriceAmount: number | null; settlementStatus: string; status: string; winnerId: string | null; orderId: string | null; paymentDeadlineAt: string | null; paidAt: string | null; determinedAt: string };

async function auctionList(path: string, signal?: AbortSignal): Promise<ApiResponse<PagedData<AuctionSummary>>> {
  const response = await api.get<ApiResponse<unknown> | unknown>(path, { signal });
  return envelope(parseAuctionList(unwrap(response)));
}

export const auctionService = {
  list: (page = 1, pageSize = 20, status?: AuctionStatus | "ALL", signal?: AbortSignal) => auctionList(`/api/v1/auctions${query(page, pageSize, status)}`, signal),
  sellerList: (page = 1, status?: AuctionStatus | "ALL", signal?: AbortSignal) => auctionList(`/api/v1/seller/auctions${query(page, 20, status)}`, signal),
  detail: async (id: string, signal?: AbortSignal) => {
    const response = await api.getWithMetadata<ApiResponse<AuctionDetail> | AuctionDetail>(`/api/v1/auctions/${idPath(id)}`, { signal });
    const auction = unwrap(response.data);
    if (auction.auctionId?.toLowerCase() !== id.toLowerCase()) throw new Error("Thông tin phiên không khớp mã đã chọn. Hãy tải lại trang.");
    return { ...response, data: envelope(auction) };
  },
  bids: async (id: string, page = 1, signal?: AbortSignal) => envelope(unwrap(await api.get<ApiResponse<PagedData<BidItem>> | PagedData<BidItem>>(`/api/v1/auctions/${idPath(id)}/bids${query(page, 20)}`, { signal }))),
  allBids: async (id: string, signal?: AbortSignal): Promise<BidItem[]> => {
    const readPage = async (page: number) => unwrap(await api.get<ApiResponse<PagedData<BidItem>> | PagedData<BidItem>>(`/api/v1/auctions/${idPath(id)}/bids?page=${page}&pageSize=100`, { signal }));
    const first = await readPage(1);
    const byBidId = new Map(first.items.map((bid) => [bid.bidId, bid]));
    for (let firstPage = 2; firstPage <= first.pagination.totalPages; firstPage += 4) {
      const pages = await Promise.all(Array.from({ length: Math.min(4, first.pagination.totalPages - firstPage + 1) }, (_, index) => readPage(firstPage + index)));
      for (const page of pages) for (const bid of page.items) byBidId.set(bid.bidId, bid);
    }
    return [...byBidId.values()];
  },
  myBids: async (page = 1, signal?: AbortSignal) => envelope(unwrap(await api.get<ApiResponse<PagedData<MyBidItem>> | PagedData<MyBidItem>>(`/api/v1/me/bids${query(page, 20)}`, { signal }))),
  myOffers: async (page = 1, signal?: AbortSignal) => envelope(unwrap(await api.get<ApiResponse<PagedData<WinnerOffer>> | PagedData<WinnerOffer>>(`/api/v1/me/auction-offers${query(page, 20)}`, { signal }))),
  settlements: async (page = 1, status = "", determinedFrom = "", signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (status) params.set("status", status);
    if (determinedFrom) params.set("determinedFrom", new Date(`${determinedFrom}T00:00:00`).toISOString());
    return unwrap(await api.get<ApiResponse<PagedData<AuctionSettlementRow>> | PagedData<AuctionSettlementRow>>(`/api/v1/auction-settlements?${params}`, { signal }));
  },
  depositRequirement: async (id: string, signal?: AbortSignal): Promise<DepositRequirement> => unwrap(await api.get<ApiResponse<DepositRequirement> | DepositRequirement>(`/api/v1/auctions/${idPath(id)}/deposit-requirement`, { signal })),
  myDeposit: async (id: string, signal?: AbortSignal): Promise<MyAuctionDeposit> => unwrap(await api.get<ApiResponse<MyAuctionDeposit> | MyAuctionDeposit>(`/api/v1/auctions/${idPath(id)}/deposits/me`, { signal })),
  createDeposit: async (id: string, acceptedPolicyVersion: number, acceptedDepositAmount: number, key: string) => unwrap(await api.post(`/api/v1/auctions/${idPath(id)}/deposits`, { acceptedPolicyVersion, acceptedDepositAmount }, { headers: { "Idempotency-Key": key } })),
  mySecondChance: async (id: string, signal?: AbortSignal): Promise<MySecondChanceOffer> => unwrap(await api.get<ApiResponse<MySecondChanceOffer> | MySecondChanceOffer>(`/api/v1/auctions/${idPath(id)}/second-chance/me`, { signal })),
  acceptOffer: (id: string, acceptedPrice: number, key: string) => api.post(`/api/v1/auctions/${idPath(id)}/second-chance/accept`, { acceptedPrice }, { headers: { "Idempotency-Key": key } }),
  declineOffer: (id: string, key: string) => api.post(`/api/v1/auctions/${idPath(id)}/second-chance/decline`, {}, { headers: { "Idempotency-Key": key } }),
  result: async (id: string, signal?: AbortSignal): Promise<ApiResponse<AuctionResult>> => {
    const result = unwrap(await api.get<ApiResponse<AuctionResult> | AuctionResult>(`/api/v1/auctions/${idPath(id)}/result`, { signal }));
    const hasWinner = ["AWAITING_WINNER_PAYMENT", "SECOND_CHANCE_OFFERED", "AWAITING_RUNNER_UP_PAYMENT", "WINNER_PAID_AWAITING_SELLER", "SETTLED"].includes(result.phase);
    return envelope({ ...result, hasWinner, winnerDisplayName: result.winner?.displayName ?? null, orderId: result.settlement?.orderId ?? null, paymentDeadlineAt: result.settlement?.paymentDeadlineAt ?? null, paidAt: null });
  },
  create: async (body: CreateAuctionRequest) => envelope(unwrap(await api.post<ApiResponse<{ auctionId: string }> | { auctionId: string }>("/api/v1/auctions", body))),
  update: async (id: string, body: UpdateAuctionRequest) => envelope(unwrap(await api.put<ApiResponse<{ auctionId: string }> | { auctionId: string }>(`/api/v1/auctions/${idPath(id)}`, body))),
  cancel: (id: string, reason?: string) => api.post(`/api/v1/auctions/${idPath(id)}/cancel`, reason ? { reason } : {}),
  recreate: async (id: string, body: Omit<CreateAuctionRequest, "skuId">) => envelope(unwrap(await api.post<ApiResponse<{ auctionId: string }> | { auctionId: string }>(`/api/v1/auctions/${idPath(id)}/recreate`, body))),
  placeBid: async (id: string, input: BidRequest, ifMatch: string, idempotencyKey = crypto.randomUUID()): Promise<PlaceBidResponse> => unwrap(await api.post<ApiResponse<PlaceBidResponse> | PlaceBidResponse>(`/api/v1/auctions/${idPath(id)}/bids`, input, { headers: { "If-Match": ifMatch, "Idempotency-Key": idempotencyKey } })),
  history: async (id: string, page = 1, signal?: AbortSignal) => envelope(unwrap(await api.get<ApiResponse<PagedData<{ historyId: string; changedAt: string; toStatus: string; reason: string | null }>> | PagedData<{ historyId: string; changedAt: string; toStatus: string; reason: string | null }>>(`/api/v1/auctions/${idPath(id)}/status-history?page=${page}&pageSize=50`, { signal }))),
  saga: async (id: string, signal?: AbortSignal): Promise<ApiResponse<AuctionSaga>> => envelope(unwrap(await api.get<ApiResponse<AuctionSaga> | AuctionSaga>(`/api/v1/admin/auctions/${idPath(id)}/saga`, { signal }))),
  /** Locks the full goods price in the buyer's wallet. Needs an Idempotency-Key; If-Match carries the auction's rowVersion. */
  buyNow: async (id: string, idempotencyKey: string, ifMatch?: string): Promise<BuyNowResponse> =>
    unwrap(await api.post<ApiResponse<BuyNowResponse> | BuyNowResponse>(`/api/v1/auctions/${idPath(id)}/buy-now`, {}, { headers: { "Idempotency-Key": idempotencyKey, ...(ifMatch ? { "If-Match": ifMatch } : {}) } })),
  acceptBelowReserve: async (id: string): Promise<ReserveApprovalResponse> =>
    unwrap(await api.post<ApiResponse<ReserveApprovalResponse> | ReserveApprovalResponse>(`/api/v1/auctions/${idPath(id)}/reserve-approval/accept`, {})),
  declineBelowReserve: async (id: string, reason?: string): Promise<ReserveApprovalResponse> =>
    unwrap(await api.post<ApiResponse<ReserveApprovalResponse> | ReserveApprovalResponse>(`/api/v1/auctions/${idPath(id)}/reserve-approval/decline`, reason ? { reason } : {})),
  /** The prices the seller set on their own auction, including the secret reserve price. Needs the server to have this call (older servers answer 404). */
  sellerPricing: async (id: string, signal?: AbortSignal): Promise<SellerAuctionPricing> =>
    unwrap(await api.get<ApiResponse<SellerAuctionPricing> | SellerAuctionPricing>(`/api/v1/seller/auctions/${idPath(id)}/pricing`, { signal })),
  sellerReserveStatus: async (signal?: AbortSignal): Promise<SellerReserveStatus> =>
    unwrap(await api.get<ApiResponse<SellerReserveStatus> | SellerReserveStatus>("/api/v1/seller/reserve-status", { signal })),
  myDeposits: async (page = 1, status = "", signal?: AbortSignal) =>
    parseMyDeposits(unwrap(await api.get<ApiResponse<unknown> | unknown>(`/api/v1/me/deposits?page=${page}&pageSize=20${status ? `&status=${encodeURIComponent(status)}` : ""}`, { signal }))) as { items: MyDepositItem[]; pagination: PagedData<MyDepositItem>["pagination"] },
  myWatchlist: async (page = 1, signal?: AbortSignal) =>
    parseMyWatchlist(unwrap(await api.get<ApiResponse<unknown> | unknown>(`/api/v1/me/watchlist?page=${page}&pageSize=20`, { signal }))) as { items: MyWatchlistItem[]; pagination: PagedData<MyWatchlistItem>["pagination"] },
  watch: async (id: string, notifyOnNewBid = true): Promise<WatchState> =>
    unwrap(await api.post<ApiResponse<WatchState> | WatchState>(`/api/v1/auctions/${idPath(id)}/watch`, { notifyOnNewBid })),
  unwatch: async (id: string): Promise<WatchState> =>
    unwrap(await api.delete<ApiResponse<WatchState> | WatchState>(`/api/v1/auctions/${idPath(id)}/watch`)),
  report: async (id: string, body: CreateAuctionReportRequest): Promise<CreateAuctionReportResponse> =>
    unwrap(await api.post<ApiResponse<CreateAuctionReportResponse> | CreateAuctionReportResponse>(`/api/v1/auctions/${idPath(id)}/reports`, body)),
  forceCancel: (id: string, reason: string) => api.post(`/api/v1/admin/auctions/${idPath(id)}/force-cancel`, { reason }),
};
