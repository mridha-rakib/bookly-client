"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ListSuperAdminReviewsParams,
  type ReviewModerationAction,
  superAdminReviewApi,
} from "@/lib/api/superAdminReview";

export const superAdminReviewKeys = {
  all: ["superAdminReview"] as const,
  list: (params: ListSuperAdminReviewsParams) =>
    [...superAdminReviewKeys.all, "list", params] as const,
  detail: (reviewId: string) => [...superAdminReviewKeys.all, "detail", reviewId] as const,
};

export const useSuperAdminReviewsQuery = (params: ListSuperAdminReviewsParams = {}) =>
  useQuery({
    queryKey: superAdminReviewKeys.list(params),
    queryFn: () => superAdminReviewApi.list(params),
  });

export const useSuperAdminReviewDetailQuery = (reviewId: string | undefined) =>
  useQuery({
    queryKey: superAdminReviewKeys.detail(reviewId ?? ""),
    queryFn: () => superAdminReviewApi.getById(reviewId as string),
    enabled: Boolean(reviewId),
  });

export const useModerateReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, action }: { reviewId: string; action: ReviewModerationAction }) =>
      superAdminReviewApi.moderate(reviewId, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: superAdminReviewKeys.all });
    },
  });
};
