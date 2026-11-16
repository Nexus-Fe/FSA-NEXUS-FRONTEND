import { api, unwrap, type ApiResponse } from "@/lib/api/client";

type Envelope<T> = ApiResponse<T> | T;

/** ReferenceType Order is a sub-order ID (never the parent order); Auction is an auction order ID. */
export type ReviewReferenceType = "Order" | "Auction";

export type PartnerReviewEligibility = {
  canReview: boolean;
  alreadyReviewed: boolean;
  /** ALREADY_REVIEWED, ORDER_NOT_COMPLETED, PERIOD_EXPIRED, NOT_PARTICIPANT or ORDER_NOT_FOUND when canReview is false. */
  reason?: string | null;
  revieweeId?: string | null;
  reviewerRole?: "Buyer" | "Seller" | null;
  expiresAt?: string | null;
};

export type ProductReviewEligibility = {
  canReview: boolean;
  alreadyReviewed: boolean;
  /** PURCHASE_NOT_FOUND, PRODUCT_BANNED, ALREADY_REVIEWED or REVIEW_WINDOW_EXPIRED when canReview is false. */
  reason?: string | null;
  reviewId?: string | null;
  expiresAt?: string | null;
};

export type MyProductReview = {
  reviewId: string;
  productId: string;
  /** The sub-order the review belongs to. */
  orderId: string;
  rating: number;
  comment?: string | null;
  reviewImages?: string[] | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type ReceivedReview = {
  reviewId: string;
  reviewerId: string;
  reviewerDisplayNameMasked?: string | null;
  reviewerAvatarUrl?: string | null;
  reviewerRole: string;
  rating: number;
  comment?: string | null;
  mediaUrls?: string[];
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type Pagination = { pageIndex: number; pageSize: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };

export type Reputation = {
  userId: string;
  currentScore: number;
  trustLevel: string;
  canBid: boolean;
  totalPositiveReviews: number;
  totalNegativeReviews: number;
  penaltyCount: number;
  nextLevelThreshold?: number | null;
  sellerScore: number;
  sellerTrustLevel: string;
  canSell: boolean;
  sellerPositiveReviews: number;
  sellerNegativeReviews: number;
  sellerPenaltyCount: number;
  sellerNextLevelThreshold?: number | null;
  updatedAt?: string | null;
};

export type CreatedPartnerReview = { reviewId: string; scoreImpact: number; rating: number };

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(name, String(value));
  }
  return search.toString();
}

export const reviewService = {
  partnerEligibility: async (referenceType: ReviewReferenceType, referenceId: string, signal?: AbortSignal): Promise<PartnerReviewEligibility> =>
    unwrap(await api.get<Envelope<PartnerReviewEligibility>>(`/api/v1/reviews/eligibility?${query({ referenceType, referenceId })}`, { signal })),

  /** The reviewed user and the role come from the order, so the form needs only the rating and the comment. */
  createPartnerReview: async (
    input: { revieweeId: string; reviewerRole: "Buyer" | "Seller"; referenceType: ReviewReferenceType; referenceId: string; rating: number; comment?: string },
  ): Promise<CreatedPartnerReview> =>
    unwrap(await api.post<Envelope<CreatedPartnerReview>>("/api/v1/reviews", { ...input, comment: input.comment?.trim() || null, mediaUrls: [] })),

  productEligibility: async (productId: string, subOrderId: string, signal?: AbortSignal): Promise<ProductReviewEligibility> =>
    unwrap(await api.get<Envelope<ProductReviewEligibility>>(
      `/api/v1/products/${encodeURIComponent(productId)}/reviews/eligibility?${query({ orderId: subOrderId })}`, { signal })),

  myProductReviews: async (productId: string, signal?: AbortSignal): Promise<MyProductReview[]> =>
    unwrap(await api.get<Envelope<MyProductReview[]>>(`/api/v1/products/${encodeURIComponent(productId)}/reviews/mine`, { signal })),

  /** Product reviews are tied to the sub-order of the purchase: send its ID as orderId. */
  createProductReview: async (productId: string, form: FormData) =>
    unwrap(await api.post<Envelope<unknown>>(`/api/v1/products/${encodeURIComponent(productId)}/reviews`, form)),

  updateProductReview: async (reviewId: string, form: FormData) =>
    unwrap(await api.put<Envelope<unknown>>(`/api/v1/reviews/${encodeURIComponent(reviewId)}`, form)),

  deleteProductReview: async (reviewId: string): Promise<void> => {
    await api.delete(`/api/v1/reviews/${encodeURIComponent(reviewId)}`);
  },

  received: async (userId: string, page = 1, pageSize = 10, rating?: number, signal?: AbortSignal): Promise<{ items: ReceivedReview[]; pagination: Pagination }> =>
    unwrap(await api.get<Envelope<{ items: ReceivedReview[]; pagination: Pagination }>>(
      `/api/v1/users/${encodeURIComponent(userId)}/reviews?${query({ page, pageSize, rating })}`, { signal })),

  myReputation: async (signal?: AbortSignal): Promise<Reputation> =>
    unwrap(await api.get<Envelope<Reputation>>("/api/v1/me/reputation", { signal })),
};

/** Words for each reason the server gives, so a form can say why it is closed instead of just disappearing. */
export const REVIEW_REASON_TEXT: Record<string, string> = {
  ALREADY_REVIEWED: "Bạn đã gửi đánh giá cho đơn này.",
  ORDER_NOT_COMPLETED: "Chỉ đánh giá được sau khi đơn hàng hoàn tất.",
  PERIOD_EXPIRED: "Đã quá 30 ngày kể từ khi đơn hoàn tất, không thể đánh giá nữa.",
  REVIEW_WINDOW_EXPIRED: "Đã quá 30 ngày kể từ khi đơn hoàn tất, không thể đánh giá nữa.",
  NOT_PARTICIPANT: "Bạn không phải người mua hoặc người bán của đơn này.",
  PURCHASE_NOT_FOUND: "Không tìm thấy lần mua hàng hoàn tất của sản phẩm này.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
  PRODUCT_BANNED: "Sản phẩm đã bị khóa nên không thể đánh giá.",
};

/** Error codes of the review APIs in words. Anything else falls back to the server's message. */
export const REVIEW_ERROR_TEXT: Record<string, string> = {
  REVIEW_ORDER_NOT_FOUND: "Không tìm thấy đơn hàng để đánh giá.",
  REVIEW_ORDER_NOT_COMPLETED: "Chỉ đánh giá được sau khi đơn hàng hoàn tất.",
  REVIEW_NOT_PARTICIPANT: "Bạn không phải người mua hoặc người bán của đơn này.",
  REVIEW_TARGET_MISMATCH: "Người được đánh giá không phải bên còn lại của đơn.",
  REVIEW_PERIOD_EXPIRED: "Đã quá 30 ngày kể từ khi đơn hoàn tất, không thể đánh giá nữa.",
  REVIEW_ALREADY_EXISTS: "Bạn đã đánh giá đơn này rồi.",
  ALREADY_REVIEWED: "Bạn đã đánh giá sản phẩm này trong đơn này rồi.",
  REVIEW_WINDOW_EXPIRED: "Đã quá 30 ngày kể từ khi đơn hoàn tất, không thể đánh giá nữa.",
  PURCHASE_NOT_FOUND: "Không tìm thấy lần mua hàng hoàn tất của sản phẩm này.",
  REVIEW_VERIFICATION_UNAVAILABLE: "Chưa xác minh được đơn hàng lúc này. Hãy thử lại sau ít phút.",
  REVIEW_REFERENCE_TYPE_NOT_SUPPORTED: "Loại đơn này chưa hỗ trợ đánh giá.",
};
