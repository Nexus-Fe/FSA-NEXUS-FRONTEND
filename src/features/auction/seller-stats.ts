export type SellerAuctionStatistics = { sellerId: string; successfulAuctions: number; failedAuctions: number; completedAuctions: number; successRate: number | null };

/** Share of the seller's finished auctions that sold. The back end sends `null` when there is nothing to divide by. */
export function successRateText(stats: Pick<SellerAuctionStatistics, "completedAuctions" | "successRate">): string {
  if (!stats.completedAuctions || stats.successRate === null || stats.successRate === undefined) return "Chưa có phiên kết thúc";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(stats.successRate)}% phiên bán thành công`;
}
