"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ListBusinessesParams, superAdminBusinessApi } from "@/lib/api/superAdminBusiness";

export const superAdminBusinessKeys = {
  all: ["superAdminBusiness"] as const,
  list: (params: ListBusinessesParams) => [...superAdminBusinessKeys.all, "list", params] as const,
  detail: (businessId: string) => [...superAdminBusinessKeys.all, "detail", businessId] as const,
};

export const useSuperAdminBusinessesQuery = (params: ListBusinessesParams = {}) =>
  useQuery({
    queryKey: superAdminBusinessKeys.list(params),
    queryFn: () => superAdminBusinessApi.list(params),
  });

export const useSuperAdminBusinessDetailQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: superAdminBusinessKeys.detail(businessId ?? ""),
    queryFn: () => superAdminBusinessApi.getById(businessId as string),
    enabled: Boolean(businessId),
  });

const useInvalidateBusinesses = () => {
  const queryClient = useQueryClient();
  return (businessId: string) => {
    void queryClient.invalidateQueries({ queryKey: superAdminBusinessKeys.all });
    void queryClient.invalidateQueries({ queryKey: superAdminBusinessKeys.detail(businessId) });
  };
};

export const useApproveBusinessMutation = () => {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: (businessId: string) => superAdminBusinessApi.approve(businessId),
    onSuccess: (_result, businessId) => invalidate(businessId),
  });
};

export const useRejectBusinessMutation = () => {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: ({ businessId, reason }: { businessId: string; reason?: string }) =>
      superAdminBusinessApi.reject(businessId, reason),
    onSuccess: (_result, variables) => invalidate(variables.businessId),
  });
};

export const useSuspendBusinessMutation = () => {
  const invalidate = useInvalidateBusinesses();
  return useMutation({
    mutationFn: ({ businessId, reason }: { businessId: string; reason?: string }) =>
      superAdminBusinessApi.suspend(businessId, reason),
    onSuccess: (_result, variables) => invalidate(variables.businessId),
  });
};
