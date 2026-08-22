import { apiRequest } from "@/lib/api/client";

/**
 * Batch 7 — Business Finance domain foundation. Matches
 * api/src/modules/finance/finance.dto.ts exactly. Owner-only on the backend (see
 * api/src/modules/finance/finance.route.ts's own comment) — this client has no separate
 * Supervisor/Staff variant because neither dashboard renders a Payouts & Finance screen
 * (see DashboardPayoutsList.tsx's own comment).
 */

export interface FinanceFeeBucketDto {
  amountCents: number;
  count: number;
}

export interface FinanceSummary {
  currency: "EUR";
  period: { from: string; to: string };
  noShowFees: FinanceFeeBucketDto;
  lateCancellationFees: FinanceFeeBucketDto;
  processingFees: { amountCents: number };
  netPayoutCents: number;
  protectedEarningsAllTimeCents: number;
}

export type FinanceTransactionType = "NO_SHOW_FEE" | "CANCELLATION_FEE";
export type FinanceTransactionStatus = "SUCCEEDED" | "FAILED" | "WAIVED" | "PENDING";
export type FinanceCustomerType = "FIRST_BOOKING" | "RETURNING";

export interface FinanceTransactionRow {
  id: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  customerType: FinanceCustomerType;
  type: FinanceTransactionType;
  date: string;
  amountCents: number;
  businessOwnedCents: number;
  status: FinanceTransactionStatus;
  currency: "EUR";
}

export interface FinanceTransactionsResponse {
  transactions: FinanceTransactionRow[];
  pagination: { page: number; limit: number; total: number };
}

export type BusinessPayoutStatus = "PENDING" | "PAID";

export interface FinancePayoutHistoryItem {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossBusinessOwnedCents: number;
  processingFeesCents: number;
  netPayoutCents: number;
  currency: "EUR";
  status: BusinessPayoutStatus;
  paidAt?: string;
  providerReference?: string;
}

export interface FinancePayoutHistoryResponse {
  payouts: FinancePayoutHistoryItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface FinancePeriodParams {
  from: string;
  to: string;
}

export const financeApi = {
  getSummary: (businessId: string, period: FinancePeriodParams) =>
    apiRequest<FinanceSummary>({
      method: "GET",
      url: `/businesses/${businessId}/finance/summary`,
      params: period,
    }),

  listTransactions: (
    businessId: string,
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number } = {},
  ) =>
    apiRequest<FinanceTransactionsResponse>({
      method: "GET",
      url: `/businesses/${businessId}/finance/transactions`,
      params: {
        ...period,
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  listPayoutHistory: (businessId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<FinancePayoutHistoryResponse>({
      method: "GET",
      url: `/businesses/${businessId}/finance/payouts`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),
};
