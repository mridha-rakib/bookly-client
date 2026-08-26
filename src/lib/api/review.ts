import { apiRequest } from "@/lib/api/client";

/**
 * Batch 14 — Reviews & Ratings. Matches api/src/modules/review/review.dto.ts's DTOs exactly.
 * Customer endpoints live under `/me` (own-booking-scoped); public endpoints live under
 * `/catalog` (CUSTOMER-authenticated, same "public business page" convention as
 * lib/api/catalog.ts — see that file's own doc comment on why there's no true anonymous-public
 * route in this codebase).
 */

export interface CustomerReview {
  id: string;
  bookingId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  editableUntil: string;
}

export interface ReviewState {
  eligible: boolean;
  review: CustomerReview | null;
}

export interface PublicReview {
  id: string;
  reviewerDisplayName: string;
  rating: number;
  comment?: string;
  createdAt: string;
  verified: true;
}

export interface PublicReviewListResult {
  reviews: PublicReview[];
  pagination: { page: number; limit: number; total: number };
}

export interface BusinessRatingSummary {
  businessId: string;
  averageRating: number | null;
  reviewCount: number;
}

export interface ReviewWriteInput {
  rating: number;
  comment?: string;
}

export const reviewApi = {
  // --- Customer (own booking's review) ---
  getStateForBooking: (bookingId: string) =>
    apiRequest<ReviewState>({ method: "GET", url: `/me/bookings/${bookingId}/review` }),

  create: (bookingId: string, input: ReviewWriteInput) =>
    apiRequest<CustomerReview>({
      method: "POST",
      url: `/me/bookings/${bookingId}/review`,
      data: input,
    }),

  update: (bookingId: string, input: ReviewWriteInput) =>
    apiRequest<CustomerReview>({
      method: "PATCH",
      url: `/me/bookings/${bookingId}/review`,
      data: input,
    }),

  // --- Public (Business rating summary + Reviews list) ---
  getBusinessRatingSummary: (businessId: string) =>
    apiRequest<BusinessRatingSummary>({
      method: "GET",
      url: `/catalog/businesses/${businessId}/reviews/summary`,
    }),

  listBusinessReviews: (businessId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<PublicReviewListResult>({
      method: "GET",
      url: `/catalog/businesses/${businessId}/reviews`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  // --- Batch 19 — Business dashboard (Owner/Supervisor viewing their OWN business's reviews).
  // Same shape as the public reads above; a separately-authorized endpoint (ownership/membership-
  // checked, not CUSTOMER-role-checked) — see api/.../review.route.ts's createBusinessReviewRoute.
  getBusinessRatingSummaryForDashboard: (businessId: string) =>
    apiRequest<BusinessRatingSummary>({
      method: "GET",
      url: `/businesses/${businessId}/reviews/summary`,
    }),

  listBusinessReviewsForDashboard: (
    businessId: string,
    pagination: { page?: number; limit?: number } = {},
  ) =>
    apiRequest<PublicReviewListResult>({
      method: "GET",
      url: `/businesses/${businessId}/reviews`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),
};
