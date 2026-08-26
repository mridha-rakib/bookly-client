"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  businessCancellationPolicyApi,
  type PutCancellationPolicyInput,
} from "@/lib/api/business-cancellation-policy";

export const cancellationPolicyKeys = {
  detail: (businessId: string) => ["cancellationPolicy", businessId] as const,
};

export const useCancellationPolicyQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: cancellationPolicyKeys.detail(businessId ?? ""),
    queryFn: () => businessCancellationPolicyApi.get(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUpdateCancellationPolicyMutation = (businessId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PutCancellationPolicyInput) =>
      businessCancellationPolicyApi.put(businessId as string, input),
    onSuccess: (data) => {
      queryClient.setQueryData(cancellationPolicyKeys.detail(businessId ?? ""), data);
    },
  });
};
