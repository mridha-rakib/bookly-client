"use client";

import { useQuery } from "@tanstack/react-query";

import { financeApi, type FinancePeriodParams } from "@/lib/api/finance";

/**
 * Batch 7 — mirrors lib/bookings/hooks.ts's own query-key/enabled-gating convention exactly.
 * No mutations: this module is read-only (see finance.route.ts — Finance has no write
 * endpoints in this phase, no real payout execution exists yet).
 */
export const financeKeys = {
  all: ["finance"] as const,
  summaries: (businessId: string) => [...financeKeys.all, "summary", businessId] as const,
  summary: (businessId: string, period: FinancePeriodParams) =>
    [...financeKeys.summaries(businessId), period] as const,
  transactionsLists: (businessId: string) => [...financeKeys.all, "transactions", businessId] as const,
  transactions: (
    businessId: string,
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number },
  ) => [...financeKeys.transactionsLists(businessId), period, pagination] as const,
  payoutHistories: (businessId: string) => [...financeKeys.all, "payouts", businessId] as const,
  payoutHistory: (businessId: string, pagination: { page?: number; limit?: number }) =>
    [...financeKeys.payoutHistories(businessId), pagination] as const,
};

export const useFinanceSummaryQuery = (
  businessId: string | undefined,
  period: FinancePeriodParams | undefined,
) =>
  useQuery({
    queryKey: financeKeys.summary(businessId ?? "", period ?? { from: "", to: "" }),
    queryFn: () => financeApi.getSummary(businessId as string, period as FinancePeriodParams),
    enabled: Boolean(businessId) && Boolean(period),
  });

export const useFinanceTransactionsQuery = (
  businessId: string | undefined,
  period: FinancePeriodParams | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: financeKeys.transactions(businessId ?? "", period ?? { from: "", to: "" }, pagination),
    queryFn: () =>
      financeApi.listTransactions(businessId as string, period as FinancePeriodParams, pagination),
    enabled: Boolean(businessId) && Boolean(period),
  });

export const usePayoutHistoryQuery = (
  businessId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: financeKeys.payoutHistory(businessId ?? "", pagination),
    queryFn: () => financeApi.listPayoutHistory(businessId as string, pagination),
    enabled: Boolean(businessId),
  });
