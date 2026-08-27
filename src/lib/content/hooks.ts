"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type CreateFaqInput,
  type FaqAudience,
  type FaqStatus,
  type UpdateFaqInput,
  contentApi,
} from "@/lib/api/content";

export const contentKeys = {
  all: ["content"] as const,
  faqs: (params: { audience: FaqAudience; status?: FaqStatus }) =>
    [...contentKeys.all, "faqs", params] as const,
  publicFaqs: (audience: FaqAudience) => [...contentKeys.all, "publicFaqs", audience] as const,
};

/** Admin Content Manager FAQ list — all statuses for the audience unless `status` narrows it. */
export const useFaqsQuery = (params: { audience: FaqAudience; status?: FaqStatus }) =>
  useQuery({
    queryKey: contentKeys.faqs(params),
    queryFn: () => contentApi.listFaqs(params),
  });

/** Public (anonymous) FAQ list — PUBLISHED only, ordered by persisted `order`. Consumed by the
 * landing-page `FaqSection` (homepage → CUSTOMER, List Your Business → BUSINESS). */
export const usePublicFaqsQuery = (audience: FaqAudience) =>
  useQuery({
    queryKey: contentKeys.publicFaqs(audience),
    queryFn: () => contentApi.listPublicFaqs(audience),
  });

export const useCreateFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFaqInput) => contentApi.createFaq(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useUpdateFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ faqId, input }: { faqId: string; input: UpdateFaqInput }) =>
      contentApi.updateFaq(faqId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useDeleteFaqMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (faqId: string) => contentApi.deleteFaq(faqId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};

export const useReorderFaqsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { audience: FaqAudience; orderedIds: string[] }) =>
      contentApi.reorderFaqs(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
};
