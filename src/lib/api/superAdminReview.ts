import { apiRequest } from "@/lib/api/client";

/** Batch 14 — Super Admin Review moderation. SUPER_ADMIN-only on the backend (see
 * api/src/modules/super-admin/super-admin.route.ts). Matches
 * api/src/modules/super-admin/super-admin-review.service.ts's DTOs exactly. */

export type ReviewModerationStatus = "PUBLISHED" | "HIDDEN" | "REMOVED";
export type ReviewModerationAction = "HIDE" | "REMOVE";

export interface ReviewModerationHistoryEntry {
  action: ReviewModerationAction;
  actorUserId: string;
  previousStatus: ReviewModerationStatus;
  resultingStatus: ReviewModerationStatus;
  createdAt: string;
}

export interface SuperAdminReviewRow {
  id: string;
  bookingId: string;
  bookingReference: string;
  businessId: string;
  businessName: string;
  reviewerDisplayName: string;
  rating: number;
  comment?: string;
  status: ReviewModerationStatus;
  createdAt: string;
  moderationHistory: ReviewModerationHistoryEntry[];
}

export interface SuperAdminReviewListResult {
  reviews: SuperAdminReviewRow[];
  pagination: { page: number; limit: number; total: number };
}

export interface ListSuperAdminReviewsParams {
  status?: ReviewModerationStatus;
  businessId?: string;
  page?: number;
  limit?: number;
}

export const superAdminReviewApi = {
  list: (params: ListSuperAdminReviewsParams = {}) =>
    apiRequest<SuperAdminReviewListResult>({
      method: "GET",
      url: "/super-admin/reviews",
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.businessId ? { businessId: params.businessId } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),

  getById: (reviewId: string) =>
    apiRequest<SuperAdminReviewRow>({ method: "GET", url: `/super-admin/reviews/${reviewId}` }),

  moderate: (reviewId: string, action: ReviewModerationAction) =>
    apiRequest<SuperAdminReviewRow>({
      method: "POST",
      url: `/super-admin/reviews/${reviewId}/moderate`,
      data: { action },
    }),
};
