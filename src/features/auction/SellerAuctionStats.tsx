"use client";

import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import { useApiResource } from "@/lib/api/use-api-resource";
import { successRateText, type SellerAuctionStatistics } from "./seller-stats";

/** `GET /api/v1/sellers/{id}/auction-statistics`, public. A failure hides the block: it is a nicety, never a reason to break the page. */
export function SellerAuctionStats({ sellerId }: { sellerId: string }) {
  const stats = useApiResource(sellerId ? `seller-auction-stats:${sellerId}` : null, async (signal) =>
    unwrap(await api.get<ApiResponse<SellerAuctionStatistics> | SellerAuctionStatistics>(`/api/v1/sellers/${encodeURIComponent(sellerId)}/auction-statistics`, { signal })));
  if (!stats.data) return null;
  return (
    <div className="product-detail-seller-facts" aria-label="Thống kê đấu giá">
      <span>{successRateText(stats.data)}</span>
      <span>{stats.data.successfulAuctions} thành công</span>
      <span>{stats.data.failedAuctions} không thành công</span>
    </div>
  );
}
