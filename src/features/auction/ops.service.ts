import { api, unwrap, type ApiResponse } from "@/lib/api/client";

type Envelope<T> = ApiResponse<T> | T;
type Page<T> = { items: T[]; pagination: { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } };

/** Auction `AdminAuctionSummaryDto`: an auction that needs attention (stuck deposit or overdue settlement). */
export type AttentionAuction = {
  auctionId: string; productId: string; sellerId: string; productName: string | null; status: string; startPriceAmount: number; currentPriceAmount: number | null;
  bidCount: number; scheduledStartAt: string; scheduledEndAt: string; hasAttentionDeposit: boolean; hasOverdueSettlement: boolean; needsAttention: boolean;
};

/** Auction `AdminAuctionReportDto`. */
export type AuctionReport = {
  reportId: string; auctionId: string; auctionTitle: string | null; auctionStatus: string | null; sellerId: string; reporterId: string; reason: string; description: string;
  status: string; adminNote?: string | null; reviewedBy?: string | null; createdAt: string; reviewedAt?: string | null;
};

function page<T>(raw: unknown, what: string): Page<T> {
  const value = raw as Page<T> | null;
  if (!value || !Array.isArray(value.items) || !value.pagination) throw new Error(`Dữ liệu ${what} không đúng định dạng.`);
  return value;
}

export const auctionOpsService = {
  async attention(pageNumber: number, signal?: AbortSignal): Promise<Page<AttentionAuction>> {
    return page(unwrap(await api.get<Envelope<Page<AttentionAuction>>>(`/api/v1/admin/auctions/attention-required?page=${pageNumber}&pageSize=20`, { signal })), "phiên cần chú ý");
  },
  async reports(pageNumber: number, status: string, signal?: AbortSignal): Promise<Page<AuctionReport>> {
    const query = new URLSearchParams({ page: String(pageNumber), pageSize: "20" });
    if (status) query.set("status", status);
    return page(unwrap(await api.get<Envelope<Page<AuctionReport>>>(`/api/v1/admin/auction-reports?${query}`, { signal })), "báo cáo đấu giá");
  },
  async dismissReports(auctionId: string, note: string): Promise<{ dismissedCount: number }> {
    return unwrap(await api.post<Envelope<{ dismissedCount: number }>>(`/api/v1/admin/auctions/${encodeURIComponent(auctionId)}/reports/dismiss`, { note }));
  },
  async invalidateBid(auctionId: string, bidId: string, reason: string): Promise<{ newCurrentPriceAmount: number | null; newBidCount: number }> {
    return unwrap(await api.post<Envelope<{ newCurrentPriceAmount: number | null; newBidCount: number }>>(`/api/v1/admin/auctions/${encodeURIComponent(auctionId)}/bids/${encodeURIComponent(bidId)}/invalidate`, { reason }));
  },
  async reconcileDeposits(auctionId: string): Promise<{ queuedDeposits: number; remainingPendingDeposits: number }> {
    return unwrap(await api.post<Envelope<{ queuedDeposits: number; remainingPendingDeposits: number }>>(`/api/v1/admin/auctions/${encodeURIComponent(auctionId)}/deposits/reconcile`, {}));
  },
  async retrySync(auctionId: string): Promise<{ pushedCommerceSettlement: boolean; pushedCatalogUnlock: boolean; resetPendingFlags: number }> {
    return unwrap(await api.post<Envelope<{ pushedCommerceSettlement: boolean; pushedCatalogUnlock: boolean; resetPendingFlags: number }>>(`/api/v1/admin/auctions/${encodeURIComponent(auctionId)}/sync/retry`, {}));
  },
};

/** A reason is required for an invalidation so the audit trail says why; the back end accepts none, the screen does not. */
export function checkOpsReason(reason: string): string | null {
  const text = reason.trim();
  if (text.length < 3) return "Nhập lý do (ít nhất 3 ký tự).";
  if (text.length > 500) return "Lý do tối đa 500 ký tự.";
  return null;
}

/** A running auction is the only one whose bids may be invalidated. */
export function canInvalidateBid(auctionStatus: string, bid: { isInvalidated?: boolean }): boolean {
  return auctionStatus.replace(/[^a-z]/gi, "").toUpperCase() === "RUNNING" && !bid.isInvalidated;
}

export function attentionReasons(item: Pick<AttentionAuction, "hasAttentionDeposit" | "hasOverdueSettlement">): string[] {
  const reasons: string[] = [];
  if (item.hasAttentionDeposit) reasons.push("Có khoản cọc đang kẹt");
  if (item.hasOverdueSettlement) reasons.push("Quyết toán quá hạn");
  return reasons;
}
