export type AuctionStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "ENDED" | "SETTLED" | "FAILED" | "CANCELLED";
export type Pagination = { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
export type PagedData<T> = { items: T[]; pagination: Pagination };
export type AuctionSummary = { auctionId: string; productId: string; skuId: string | null; sellerId: string; productName: string | null; primaryImageUrl: string | null; status: AuctionStatus; startPriceAmount: number; currentPriceAmount: number | null; bidCount: number; scheduledStartAt: string; scheduledEndAt: string; createdAt: string; /** Buy Now and reserve price fields; older servers do not send them. The reserve price itself is never sent. */ buyNowPriceAmount?: number | null; hasReservePrice?: boolean; isReserveMet?: boolean | null; buyNowAvailable?: boolean };
export type AuctionDetail = AuctionSummary & { description: string | null; images: { url: string; isPrimary: boolean }[]; specifications: Record<string, unknown> | { name: string; value: unknown }[] | null; bidStepAmount: number; leadingBidderDisplayName?: string | null; originalEndAt: string; startedAt: string | null; endedAt: string | null; extensionCount: number; maxExtensionCount: number; antiSnipingExtensionMinutes: number; minReputationToBid?: number | null; recreatedFromAuctionId: string | null; createdAt: string; rowVersion: number };
export type BidItem = { bidId: string; sequenceNo: number; bidderId: string; bidderDisplayName: string; amount: number; placedAt: string; isOutbid: boolean; isWinning: boolean; isInvalidated: boolean };
export type MyBidItem = { bidId: string; auctionId: string; auctionTitle: string; status: AuctionStatus | null; sequenceNo: number; amount: number; placedAt: string; isOutbid: boolean; isWinning: boolean; isInvalidated: boolean };
export type WinnerOffer = { offerId: string; auctionId: string; auctionTitle: string; bidId: string; amount: number; status: string; isExpired: boolean; offeredAt: string; expiresAt: string; respondedAt: string | null; responseReason: string | null };
export type AuctionResult = { auctionId: string; status: AuctionStatus | null; phase: string; winnerId: string | null; winningBidId: string | null; finalPriceAmount: number | null; determinedAt: string | null; winner: { bidderId: string | null; displayName: string | null } | null; winningAmount: number | null; settlement: { orderId: string | null; settlementStatus: string; depositAmount: number; remainingAmount: number; paymentDeadlineAt: string | null; /** Only the seller and staff receive these; older servers do not send them. */ awaitingSellerApproval?: boolean; sellerApprovalDeadlineAt?: string | null } | null; myDeposit: { status: string; amount: number } | null; secondChance: { offerId: string | null; bidderId: string | null; status: string; offerPrice: number | null; respondBy: string | null } | null; hasWinner: boolean; winnerDisplayName: string | null; orderId: string | null; paymentDeadlineAt: string | null; paidAt: string | null };
export type DepositRequirement = { auctionId: string; currency: string; startPrice: number; depositAmount: number; ratePercent: number; minDepositApplied: boolean; policyVersion: number; canJoin: boolean; buyerStanding: { reputationScore: number | null; isNewUser: boolean; violationStreak: number }; forfeiturePolicy: { sellerPercent: number; platformPercent: number }; existingDeposit: { depositId: string; status: string } | null };
export type MyAuctionDeposit = { depositId: string | null; status: string; amount: number | null; canBid: boolean; blockReason: string | null };
export type MySecondChanceOffer = { offerId: string; status: string; offerPrice: number; currency: string; offeredAt: string; respondBy: string; orderId: string | null; paymentDeadlineAt: string | null; notice: string };
export type AuctionStatusHistory = { auctionId: string; items: { id: string; fromStatus: AuctionStatus | null; toStatus: AuctionStatus; reason: string | null; changedBy: string | null; changedAt: string }[] };
export type AuctionSaga = { auctionId: string; sagaType: string; currentState: string; stateData: { productId: string; sellerId: string; status: AuctionStatus; isFinished: boolean; waitingFor: string | null; deadlineAt: string | null; isOverdue: boolean; steps: { name: string; state: string; at: string | null; detail: string | null }[] }; createdAt: string; updatedAt: string };
export type CreateAuctionRequest = { skuId: string; startPriceAmount: number; bidStepAmount?: number; scheduledStartAt: string; scheduledEndAt: string; reservePriceAmount?: number; buyNowPriceAmount?: number };
export type UpdateAuctionRequest = Partial<Pick<CreateAuctionRequest, "startPriceAmount" | "bidStepAmount" | "scheduledStartAt" | "scheduledEndAt" | "reservePriceAmount" | "buyNowPriceAmount">>;
export type BidRequest = { amount: number };
export type PlaceBidResponse = { bidId: string; auctionId: string; bidSeq: number; amount: number; placedAt: string; currentPriceAmount: number; bidCount: number; scheduledEndAt: string; extensionCount: number; previousPriceAmount: number | null; rowVersion: number };
export type BuyNowResponse = { auctionId: string; winnerId: string; buyNowPriceAmount: number; depositAmountHeld: number; remainingGoodsAmountHeld: number; status: AuctionStatus | string; endedAt: string; paymentDeadlineAt: string; rowVersion: number };
export type ReserveApprovalResponse = { auctionId: string; auctionStatus: string; settlementStatus: string; acceptedPriceAmount: number | null; paymentDeadlineAt: string | null; consecutiveDeclineCount: number; reserveRestrictedUntil: string | null; respondedAt: string };
export type SellerReserveStatus = { sellerId: string; consecutiveDeclineCount: number; isReserveRestricted: boolean; reserveRestrictedUntil: string | null };
export type MyDepositItem = { depositId: string; auctionId: string; auctionTitle: string; auctionStatus: AuctionStatus | string | null; amount: number; ratePercent: number; status: string; capturePurpose: string | null; policyVersion: number; authorizedAt: string | null; releasedAt: string | null; capturedAt: string | null; createdAt: string };
export type MyWatchlistItem = { auctionId: string; productId: string; skuId: string | null; sellerId: string; productName: string | null; primaryImageUrl: string | null; status: AuctionStatus | string; startPriceAmount: number; currentPriceAmount: number | null; bidCount: number; notifyOnNewBid: boolean; scheduledStartAt: string; scheduledEndAt: string; watchedAt: string };
export type WatchState = { isWatching: boolean; notifyOnNewBid: boolean };
export type SellerAuctionPricing = { auctionId: string; startPriceAmount: number; reservePriceAmount: number | null; buyNowPriceAmount: number | null };

export type AuctionReportReason =
  | "SuspectedShillBidding"
  | "CounterfeitOrFake"
  | "MisleadingInfo"
  | "ExternalContact"
  | "Other";

export type CreateAuctionReportRequest = {
  reason: AuctionReportReason;
  description: string;
};

export type CreateAuctionReportResponse = {
  reportId: string;
  auctionId: string;
  reason: AuctionReportReason;
  status: string;
  createdAt: string;
};

