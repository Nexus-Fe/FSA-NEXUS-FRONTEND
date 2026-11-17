import { api, unwrap, type ApiResponse } from "@/lib/api/client";
import type { UpdateUserProfile, UserProfile } from "../types";

export type ReputationPolicy = {
  enforcementEnabled: boolean;
  minScoreToBid: number;
  minScoreToSell: number;
  maxScore: number;
  trustLevels: Array<{ level: string; minScore: number; maxScore: number; description: string }>;
};

export type MyReputation = {
  userId: string;
  currentScore: number;
  trustLevel: string;
  canBid: boolean;
  nextLevelThreshold: number | null;
  sellerScore: number;
  sellerTrustLevel: string;
  canSell: boolean;
  sellerNextLevelThreshold: number | null;
};

export type ReceivedReview = {
  reviewId: string;
  reviewerDisplayNameMasked: string;
  reviewerRole: string;
  rating: number;
  comment: string | null;
  referenceType: string;
  referenceId: string;
  createdAt: string;
};

export type ReceivedReviewsPage = {
  items: ReceivedReview[];
  pagination: { pageIndex: number; totalCount: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
};

export const profileService = {
  getProfile: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<UserProfile> | UserProfile>("/api/v1/me", { signal })),
  updateProfile: async (changes: UpdateUserProfile) =>
    unwrap(await api.patch<ApiResponse<UserProfile> | UserProfile>("/api/v1/me", changes)),
  getReputationPolicy: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<ReputationPolicy> | ReputationPolicy>("/api/v1/reputation/policy", { signal })),
  getMyReputation: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<MyReputation> | MyReputation>("/api/v1/me/reputation", { signal })),
  getReceivedReviews: async (userId: string, page: number, rating: number | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (rating) params.set("rating", String(rating));
    return unwrap(await api.get<ApiResponse<ReceivedReviewsPage> | ReceivedReviewsPage>(`/api/v1/users/${encodeURIComponent(userId)}/reviews?${params}`, { signal }));
  },
};
