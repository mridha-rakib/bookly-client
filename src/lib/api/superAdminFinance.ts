import { apiRequest } from "@/lib/api/client";
import type {
  BusinessPayoutStatus,
  FinanceCustomerType,
  FinancePayoutHistoryItem,
  FinancePeriodParams,
  FinanceSummary,
  FinanceTransactionRow,
  FinanceTransactionsResponse,
} from "@/lib/api/finance";

/**
 * Batch 8 — Super Admin's platform-wide + per-Business finance surface. SUPER_ADMIN-only on the
 * backend (see api/src/modules/super-admin/super-admin.route.ts). Reuses the same
 * FinanceSummary/FinanceTransactionRow shapes as the Business Owner's own finance API
 * (lib/api/finance.ts) for the per-Business endpoints, since the backend derives both from the
 * exact same primitives (rule #17).
 */

export type PlatformOwnedTotals = {
  grossCents: number;
  processingFeesCents: number;
  refundsCents: number;
  netCents: number;
};

export interface PlatformFinanceSummary {
  currency: "EUR";
  period: { from: string; to: string };
  bookly: PlatformOwnedTotals;
  collectedForBusinesses: {
    amountCents: number;
    noShowAmountCents: number;
    cancellationAmountCents: number;
  };
  sentToBusinesses: { amountCents: number; payoutCount: number };
  pendingPayouts: { amountCents: number; businessCount: number };
  protectedEarningsAllTimeCents: number;
}

export type PlatformTransactionType = "NO_SHOW_FEE" | "CANCELLATION_FEE" | "PLATFORM_FEE" | "REFUND";

export interface PlatformTransactionRow {
  id: string;
  businessId: string;
  businessName: string;
  bookingId: string;
  bookingReference: string;
  customerName: string;
  type: PlatformTransactionType;
  date: string;
  grossCents: number;
  stripeFeeCents: number;
  netCents: number;
  owner: "BOOKLY" | "BUSINESS" | "CUSTOMER";
  status: FinanceTransactionRow["status"];
  payoutId?: string;
  currency: "EUR";
}

export interface PlatformTransactionsResponse {
  transactions: PlatformTransactionRow[];
  pagination: { page: number; limit: number; total: number };
}

export interface BusinessPayableSummary {
  businessId: string;
  businessName: string;
  city: string;
  category: string;
  grossCents: number;
  processingFeesCents: number;
  refundsCents: number;
  netCents: number;
  transactionCount: number;
  noShowAmountCents: number;
  cancellationAmountCents: number;
  depositAmountCents: number;
}

export interface PendingPayoutsResponse {
  items: BusinessPayableSummary[];
  totalPendingCents: number;
  businessCount: number;
}

export interface PlatformPayoutHistoryItem {
  id: string;
  businessId: string;
  businessName: string;
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

export interface PlatformPayoutHistoryResponse {
  payouts: PlatformPayoutHistoryItem[];
  pagination: { page: number; limit: number; total: number };
}

export interface ExecutedPayout {
  id: string;
  businessId: string;
  periodStart: string;
  periodEnd: string;
  grossBusinessOwnedCents: number;
  processingFeesCents: number;
  refundsCents: number;
  netPayoutCents: number;
  currency: "EUR";
  status: BusinessPayoutStatus;
  settledTransactionCount: number;
  providerReference?: string;
  paidAt?: string;
  createdAt: string;
}

export const superAdminFinanceApi = {
  // --- Platform-wide ---
  getPlatformSummary: (period: FinancePeriodParams) =>
    apiRequest<PlatformFinanceSummary>({
      method: "GET",
      url: "/super-admin/finance/summary",
      params: period,
    }),

  listPlatformTransactions: (
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number } = {},
    types?: PlatformTransactionType[],
  ) =>
    apiRequest<PlatformTransactionsResponse>({
      method: "GET",
      url: "/super-admin/finance/transactions",
      params: {
        ...period,
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
        ...(types && types.length > 0 ? { types: types.join(",") } : {}),
      },
    }),

  listPendingPayouts: () =>
    apiRequest<PendingPayoutsResponse>({ method: "GET", url: "/super-admin/finance/pending-payouts" }),

  listPlatformPayoutHistory: (pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<PlatformPayoutHistoryResponse>({
      method: "GET",
      url: "/super-admin/finance/payouts",
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  // --- Per-Business (Business Detail Finance tab) ---
  getBusinessSummary: (businessId: string, period: FinancePeriodParams) =>
    apiRequest<FinanceSummary>({
      method: "GET",
      url: `/super-admin/businesses/${businessId}/finance/summary`,
      params: period,
    }),

  listBusinessTransactions: (
    businessId: string,
    period: FinancePeriodParams,
    pagination: { page?: number; limit?: number } = {},
  ) =>
    apiRequest<FinanceTransactionsResponse>({
      method: "GET",
      url: `/super-admin/businesses/${businessId}/finance/transactions`,
      params: {
        ...period,
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  getBusinessPayable: (businessId: string) =>
    apiRequest<BusinessPayableSummary>({
      method: "GET",
      url: `/super-admin/businesses/${businessId}/finance/payable`,
    }),

  listBusinessPayoutHistory: (businessId: string, pagination: { page?: number; limit?: number } = {}) =>
    apiRequest<{
      payouts: FinancePayoutHistoryItem[];
      pagination: { page: number; limit: number; total: number };
    }>({
      method: "GET",
      url: `/super-admin/businesses/${businessId}/finance/payouts`,
      params: {
        ...(pagination.page ? { page: String(pagination.page) } : {}),
        ...(pagination.limit ? { limit: String(pagination.limit) } : {}),
      },
    }),

  /** "Send SEPA" / "Confirm Transfer" — one-step, self-attested (see the backend's own
   * business-payout.model.ts doc comment on this confirmed product decision). */
  executePayout: (businessId: string, providerReference?: string) =>
    apiRequest<ExecutedPayout>({
      method: "POST",
      url: `/super-admin/businesses/${businessId}/finance/payouts`,
      data: { providerReference },
    }),
};

export type { FinanceCustomerType };
