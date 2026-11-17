"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BooklyApiError } from "@/lib/api/client";
import type { FinancePeriodParams } from "@/lib/api/finance";
import {
  type PayoutRecordInput,
  superAdminFinanceApi,
  type PlatformTransactionType,
} from "@/lib/api/superAdminFinance";
import { financeKeys } from "@/lib/finance/hooks";
import { centralPayoutsApi, type InitiateCentralPayoutInput } from "@/lib/api/centralPayouts";

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

/** "Record bank transfer" — records a transfer already completed outside Bookly, bound to the
 * reviewed amount + snapshot. On success every cached view that could now be stale is
 * invalidated: all Super Admin finance reads (pending list, platform summary/history, the
 * Business's payable/summary/history) and any cached Business Owner finance reads. A refused
 * record (e.g. the payable changed after review) also refreshes, so the current amount shows. */
export const useExecutePayoutMutation = () => {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: superAdminFinanceKeys.all });
    void queryClient.invalidateQueries({ queryKey: financeKeys.all });
  };

  return useMutation({
    mutationFn: ({ businessId, ...input }: { businessId: string } & PayoutRecordInput) =>
      superAdminFinanceApi.executePayout(businessId, input),
    onSuccess: refresh,
    onError: (error) => {
      if (error instanceof BooklyApiError && error.status === 409) refresh();
    },
  });
};

// --- P0.6 central Stripe withdrawals ---------------------------------------------------------

export const centralPayoutKeys = {
  all: [...superAdminFinanceKeys.all, "centralPayouts"] as const,
  overview: () => [...centralPayoutKeys.all, "overview"] as const,
  bankAccount: () => [...centralPayoutKeys.all, "bankAccount"] as const,
  list: (page: number, limit: number) => [...centralPayoutKeys.all, "list", page, limit] as const,
};

export const useCentralPayoutOverviewQuery = () =>
  useQuery({
    queryKey: centralPayoutKeys.overview(),
    queryFn: () => centralPayoutsApi.getOverview(),
    retry: false,
  });

export const usePlatformBankAccountQuery = () => useQuery({
  queryKey: centralPayoutKeys.bankAccount(),
  queryFn: () => centralPayoutsApi.getBankAccount(),
  retry: false,
});

export const useCentralPayoutsQuery = (page: number, limit: number) =>
  useQuery({
    queryKey: centralPayoutKeys.list(page, limit),
    queryFn: () => centralPayoutsApi.list(page, limit),
  });

export const useInitiateCentralPayoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InitiateCentralPayoutInput) => centralPayoutsApi.initiate(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: centralPayoutKeys.all }),
  });
};

export const useRefreshCentralPayoutMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (operationId: string) => centralPayoutsApi.refresh(operationId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: centralPayoutKeys.all }),
  });
};
