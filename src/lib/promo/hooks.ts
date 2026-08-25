"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type ListPromosParams,
  type PromoStoredStatus,
  type PromoUpdateInput,
  type PromoWriteInput,
  promoApi,
} from "@/lib/api/promo";

export const promoKeys = {
  all: ["promo"] as const,
  list: (params: ListPromosParams) => [...promoKeys.all, "list", params] as const,
  detail: (promoId: string) => [...promoKeys.all, "detail", promoId] as const,
  redemptions: (promoId: string, pagination: { page?: number; limit?: number }) =>
    [...promoKeys.all, "redemptions", promoId, pagination] as const,
  discountedMoney: (period: { from: string; to: string }) =>
    [...promoKeys.all, "discountedMoney", period] as const,
};

export const usePromoListQuery = (params: ListPromosParams = {}) =>
  useQuery({
    queryKey: promoKeys.list(params),
    queryFn: () => promoApi.list(params),
  });

export const usePromoDetailQuery = (promoId: string | undefined) =>
  useQuery({
    queryKey: promoKeys.detail(promoId ?? ""),
    queryFn: () => promoApi.getById(promoId as string),
    enabled: Boolean(promoId),
  });

export const usePromoRedemptionsQuery = (
  promoId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: promoKeys.redemptions(promoId ?? "", pagination),
    queryFn: () => promoApi.listRedemptions(promoId as string, pagination),
    enabled: Boolean(promoId),
  });

export const usePromoDiscountedMoneyQuery = (period: { from: string; to: string } | undefined) =>
  useQuery({
    queryKey: promoKeys.discountedMoney(period ?? { from: "", to: "" }),
    queryFn: () => promoApi.getDiscountedMoney(period as { from: string; to: string }),
    enabled: Boolean(period),
  });

export const useCreatePromoMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PromoWriteInput) => promoApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.all });
    },
  });
};

export const useUpdatePromoMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ promoId, input }: { promoId: string; input: PromoUpdateInput }) =>
      promoApi.update(promoId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.all });
    },
  });
};

export const useSetPromoStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ promoId, status }: { promoId: string; status: PromoStoredStatus }) =>
      promoApi.setStatus(promoId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.all });
    },
  });
};

export const useDeletePromoMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promoId: string) => promoApi.remove(promoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promoKeys.all });
    },
  });
};
