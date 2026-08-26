"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ReviewWriteInput, reviewApi } from "@/lib/api/review";

export const reviewKeys = {
  all: ["review"] as const,
  state: (bookingId: string) => [...reviewKeys.all, "state", bookingId] as const,
  businessSummary: (businessId: string) =>
    [...reviewKeys.all, "businessSummary", businessId] as const,
  businessList: (businessId: string, pagination: { page?: number; limit?: number }) =>
    [...reviewKeys.all, "businessList", businessId, pagination] as const,
};

export const useReviewStateQuery = (bookingId: string | undefined) =>
  useQuery({
    queryKey: reviewKeys.state(bookingId ?? ""),
    queryFn: () => reviewApi.getStateForBooking(bookingId as string),
    enabled: Boolean(bookingId),
  });

export const useBusinessRatingSummaryQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: reviewKeys.businessSummary(businessId ?? ""),
    queryFn: () => reviewApi.getBusinessRatingSummary(businessId as string),
    enabled: Boolean(businessId),
  });

export const useBusinessReviewsQuery = (
  businessId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: reviewKeys.businessList(businessId ?? "", pagination),
    queryFn: () => reviewApi.listBusinessReviews(businessId as string, pagination),
    enabled: Boolean(businessId),
  });

// Batch 19 — Business dashboard (Owner/Supervisor) variants, same query key shape with a "dashboard"
// segment so they never collide in cache with the public/customer-facing reads above.
export const useBusinessRatingSummaryForDashboardQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: [...reviewKeys.businessSummary(businessId ?? ""), "dashboard"],
    queryFn: () => reviewApi.getBusinessRatingSummaryForDashboard(businessId as string),
    enabled: Boolean(businessId),
  });

export const useBusinessReviewsForDashboardQuery = (
  businessId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: [...reviewKeys.businessList(businessId ?? "", pagination), "dashboard"],
    queryFn: () => reviewApi.listBusinessReviewsForDashboard(businessId as string, pagination),
    enabled: Boolean(businessId),
  });

export const useCreateReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: ReviewWriteInput }) =>
      reviewApi.create(bookingId, input),
    onSuccess: (_review, variables) => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.state(variables.bookingId) });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
};

export const useUpdateReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: ReviewWriteInput }) =>
      reviewApi.update(bookingId, input),
    onSuccess: (_review, variables) => {
      void queryClient.invalidateQueries({ queryKey: reviewKeys.state(variables.bookingId) });
      void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
    },
  });
};
