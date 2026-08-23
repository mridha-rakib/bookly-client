"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FinancePeriodParams } from "@/lib/api/finance";
import { superAdminFinanceApi, type PlatformTransactionType } from "@/lib/api/superAdminFinance";

export const superAdminFinanceKeys = {
  all: ["superAdminFinance"] as const,
  platformSummary: (period: FinancePeriodParams) =>
    [...superAdminFinanceKeys.all, "platformSummary", period] as const,
  platformTransactions: (
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number },
    types?: PlatformTransactionType[],
  ) => [...superAdminFinanceKeys.all, "platformTransactions", period, pagination, types] as const,
  pendingPayouts: () => [...superAdminFinanceKeys.all, "pendingPayouts"] as const,
  platformPayoutHistory: (pagination: { page?: number; limit?: number }) =>
    [...superAdminFinanceKeys.all, "platformPayoutHistory", pagination] as const,
  businessSummary: (businessId: string, period: FinancePeriodParams) =>
    [...superAdminFinanceKeys.all, "businessSummary", businessId, period] as const,
  businessTransactions: (
    businessId: string,
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number },
  ) => [...superAdminFinanceKeys.all, "businessTransactions", businessId, period, pagination] as const,
  businessPayable: (businessId: string) =>
    [...superAdminFinanceKeys.all, "businessPayable", businessId] as const,
  businessPayoutHistory: (businessId: string, pagination: { page?: number; limit?: number }) =>
    [...superAdminFinanceKeys.all, "businessPayoutHistory", businessId, pagination] as const,
};

export const useSuperAdminPlatformSummaryQuery = (period: FinancePeriodParams | undefined) =>
  useQuery({
    queryKey: superAdminFinanceKeys.platformSummary(period ?? { from: "", to: "" }),
    queryFn: () => superAdminFinanceApi.getPlatformSummary(period as FinancePeriodParams),
    enabled: Boolean(period),
  });

export const useSuperAdminPlatformTransactionsQuery = (
  period: FinancePeriodParams | undefined,
  pagination: { page?: number; limit?: number } = {},
  types?: PlatformTransactionType[],
) =>
  useQuery({
    queryKey: superAdminFinanceKeys.platformTransactions(period ?? { from: "", to: "" }, pagination, types),
    queryFn: () =>
      superAdminFinanceApi.listPlatformTransactions(period as FinancePeriodParams, pagination, types),
    enabled: Boolean(period),
  });

export const useSuperAdminPendingPayoutsQuery = () =>
  useQuery({
    queryKey: superAdminFinanceKeys.pendingPayouts(),
    queryFn: () => superAdminFinanceApi.listPendingPayouts(),
  });

export const useSuperAdminPlatformPayoutHistoryQuery = (
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: superAdminFinanceKeys.platformPayoutHistory(pagination),
    queryFn: () => superAdminFinanceApi.listPlatformPayoutHistory(pagination),
  });

export const useSuperAdminBusinessSummaryQuery = (
  businessId: string | undefined,
  period: FinancePeriodParams | undefined,
) =>
  useQuery({
    queryKey: superAdminFinanceKeys.businessSummary(businessId ?? "", period ?? { from: "", to: "" }),
    queryFn: () =>
      superAdminFinanceApi.getBusinessSummary(businessId as string, period as FinancePeriodParams),
    enabled: Boolean(businessId) && Boolean(period),
  });

export const useSuperAdminBusinessTransactionsQuery = (
  businessId: string | undefined,
  period: FinancePeriodParams | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: superAdminFinanceKeys.businessTransactions(
      businessId ?? "",
      period ?? { from: "", to: "" },
      pagination,
    ),
    queryFn: () =>
      superAdminFinanceApi.listBusinessTransactions(
        businessId as string,
        period as FinancePeriodParams,
        pagination,
      ),
    enabled: Boolean(businessId) && Boolean(period),
  });

export const useSuperAdminBusinessPayableQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: superAdminFinanceKeys.businessPayable(businessId ?? ""),
    queryFn: () => superAdminFinanceApi.getBusinessPayable(businessId as string),
    enabled: Boolean(businessId),
  });

export const useSuperAdminBusinessPayoutHistoryQuery = (
  businessId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: superAdminFinanceKeys.businessPayoutHistory(businessId ?? "", pagination),
    queryFn: () => superAdminFinanceApi.listBusinessPayoutHistory(businessId as string, pagination),
    enabled: Boolean(businessId),
  });

/** "Send SEPA" / "Confirm Transfer" — invalidates every cached view that could now be stale
 * (pending list, platform summary, the settled Business's own payable/summary/history). */
export const useExecutePayoutMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      providerReference,
    }: {
      businessId: string;
      providerReference?: string;
    }) => superAdminFinanceApi.executePayout(businessId, providerReference),
    onSuccess: (_payout, variables) => {
      void queryClient.invalidateQueries({ queryKey: superAdminFinanceKeys.all });
      void queryClient.invalidateQueries({
        queryKey: superAdminFinanceKeys.businessPayable(variables.businessId),
      });
    },
  });
};
