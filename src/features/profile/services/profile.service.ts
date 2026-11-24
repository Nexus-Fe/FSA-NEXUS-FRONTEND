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

export type MyPenaltyItem = {
  penaltyId: string;
  targetRole: "Buyer" | "Seller" | "Account" | string;
  violationType: string;
  reason: string;
  penaltyApplied: "Warning" | "DeductPoints" | "Restriction" | "BanAccount" | "Other" | string;
  pointsDeducted: number;
  status: "Active" | "Expired" | "Revoked" | string;
  policyClauseCode?: string | null;
  issuedAt: string;
  expiresAt?: string | null;
  isCurrentlyActive: boolean;
};

export type MyPenaltiesPage = {
  items: MyPenaltyItem[];
  pagination: { currentPage: number; pageSize: number; totalCount: number; totalPages: number; hasPrevious: boolean; hasNext: boolean };
};

export const profileService = {
  getProfile: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<UserProfile> | UserProfile>("/api/v1/me", { signal })),
  updateProfile: async (changes: UpdateUserProfile) =>
    unwrap(await api.patch<ApiResponse<UserProfile> | UserProfile>("/api/v1/me", changes)),
  uploadAvatar: async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return unwrap(
      await api.post<ApiResponse<{ avatarUrl: string; updatedAt: string }> | { avatarUrl: string; updatedAt: string }>(
        "/api/v1/me/avatar",
        body,
      ),
    );
  },
  getReputationPolicy: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<ReputationPolicy> | ReputationPolicy>("/api/v1/reputation/policy", { signal })),
  getMyReputation: async (signal?: AbortSignal) =>
    unwrap(await api.get<ApiResponse<MyReputation> | MyReputation>("/api/v1/me/reputation", { signal })),
  getReceivedReviews: async (userId: string, page: number, rating: number | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (rating) params.set("rating", String(rating));
    return unwrap(await api.get<ApiResponse<ReceivedReviewsPage> | ReceivedReviewsPage>(`/api/v1/users/${encodeURIComponent(userId)}/reviews?${params}`, { signal }));
  },
  getMyPenalties: async (page = 1, pageSize = 10, signal?: AbortSignal) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return unwrap(await api.get<ApiResponse<MyPenaltiesPage> | MyPenaltiesPage>(`/api/v1/me/penalties?${params}`, { signal }));
  },
};
