"use client";

import { PartnerReviewCard } from "@/features/reviews/PartnerReviewCard";

/** The seller reviews the buyer of one sub-order. The buyer and the role are taken from the order by the server. */
export function SellerBuyerReview({ subOrderId }: { buyerId?: string; subOrderId: string }) {
  return <PartnerReviewCard referenceType="Order" referenceId={subOrderId} title="Đánh giá người mua" counterpart="người mua" />;
}
