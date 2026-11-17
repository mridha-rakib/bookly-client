import { apiRequest } from "@/lib/api/client";

// P0.6 — Super Admin withdrawals from Bookly's central Stripe balance. Matches
// api/src/modules/central-payout/central-payout.route.ts. Amounts are integer minor units.

export type CentralStripeMode = "TEST" | "LIVE";
export interface PlatformBankAccountSummary {
  mode: CentralStripeMode | null;
  managedBy: "STRIPE";
  state: "NOT_CONFIGURED" | "NO_DESTINATION" | "UNAVAILABLE" | "CONFIGURED";
  payoutsEnabled: boolean | null;
  inventoryComplete?: boolean;
  unavailableReason?: "PERMISSIONS" | "PROVIDER" | "INCOMPLETE";
  destinations: {
    bankName: string | null;
    last4: string | null;
    currency: string | null;
    country: string | null;
    status: string | null;
    defaultForCurrency: boolean | null;
  }[];
}
export type CentralPayoutState = "PREPARED" | "UNKNOWN" | "SUBMITTED" | "REJECTED";
export type ProviderPayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";

export interface CentralBankDestination {
  id: string;
  bankName: string | null;
  last4: string;
  currency: string;
  country: string;
  status: string;
  defaultForCurrency: boolean | null;
  eligible: boolean;
}

/**
 * FG03B-0 — one recent Stripe payout, from any origin. `origin` is BOOKLY_WITHDRAWAL only when
 * a Bookly withdrawal record holds this exact Stripe payout id in the same mode; otherwise
 * NOT_VERIFIED (never "unauthorized": it may be a Dashboard/automatic payout or a Bookly
 * withdrawal not yet linked). Optional fields are absent from older API builds.
 */
export interface CentralProviderPayout {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  /** Stripe's estimate only. */
  arrivalDate: string | null;
  created: string;
  automatic: boolean;
  livemode?: boolean;
  failureCode?: string | null;
  destinationLast4?: string | null;
  origin?: "BOOKLY_WITHDRAWAL" | "LINKAGE_UNRESOLVED" | "NOT_VERIFIED";
  booklyOperationId?: string | null;
}

/** What the recent-payout list covers: a bounded sample, never a complete history. */
export interface RecentStripePayoutsScope {
  shown: number;
  returnedByStripe: number;
  requestLimit: number;
}

export interface CentralPayoutOverview {
  mode: CentralStripeMode | null;
  liveExecutionEnabled: boolean;
  balances: { currency: string; availableCents: number; pendingCents: number }[];
  payoutsInProgress: { currency: string; amountCents: number }[];
  destinations: CentralBankDestination[];
  scheduleInterval: string | null;
  restrictions: { code: string; message: string }[];
  recentStripePayouts: CentralProviderPayout[];
  recentStripePayoutsScope?: RecentStripePayoutsScope;
  businessAttributedUnpaid: { currency: string; amountCents: number } | null;
  /** FG03B-1 — absent from older API builds. Never a permission to withdraw. */
  reconciliation?: ReconciliationReadiness;
}

export type HistoryCoverageState = "NEVER_RUN" | "IN_PROGRESS" | "COMPLETE";

/**
 * FG03B-1 — read-only payout-evidence status (api payout-reconciliation.ts). `evidenceComplete`
 * only means Bookly holds complete, fully linked payout evidence up to `completeAsOf`; it is NOT
 * permission to withdraw.
 */
export interface ReconciliationReadiness {
  mode: CentralStripeMode | null;
  evidenceComplete: boolean;
  reviewNeeded: boolean;
  coverage: {
    state: HistoryCoverageState;
    completeAsOf: string | null;
    lastCompletedAt: string | null;
    lastRunAt: string | null;
    runInProgress: { pages: number; observed: number } | null;
    lastError: string | null;
    accountMatches: boolean | null;
  };
  observations: {
    total: number;
    verifiedBookly: number;
    notVerified: number;
    unresolved: number;
    inFlight: number;
  };
  unresolvedWithdrawalOperations: number;
  syncEnabled: boolean;
  blockers: { code: string; message: string }[];
}

export interface HistorySyncResult {
  mode: CentralStripeMode;
  outcome: "COMPLETED" | "PAUSED_AT_PAGE_LIMIT" | "PROVIDER_ERROR" | "LEASE_LOST";
  state: HistoryCoverageState;
  pagesThisCall: number;
  observedThisCall: number;
  completeAsOf: string | null;
  error: string | null;
}

export interface CentralPayoutOperation {
  id: string;
  mode: CentralStripeMode;
  amountCents: number;
  currency: string;
  destination: { bankName: string | null; last4: string };
  state: CentralPayoutState;
  providerPayoutId: string | null;
  providerStatus: ProviderPayoutStatus | null;
  estimatedArrivalAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  initiatedBy: { userId: string; email: string };
  createdAt: string;
  lastSyncedAt: string | null;
  audit: { at: string; kind: string; source: string | null; detail: string | null }[];
}

export interface InitiateCentralPayoutInput {
  requestId: string;
  amountCents: number;
  currency: string;
  destinationId: string;
  currentPassword: string;
}

export const centralPayoutsApi = {
  getBankAccount: () => apiRequest<PlatformBankAccountSummary>({
    method: "GET", url: "/super-admin/finance/withdrawals/bank-account",
  }),
  getOverview: () =>
    apiRequest<CentralPayoutOverview>({ method: "GET", url: "/super-admin/finance/withdrawals/overview" }),
  list: (page: number, limit: number) =>
    apiRequest<{
      withdrawals: CentralPayoutOperation[];
      pagination: { page: number; limit: number; total: number };
    }>({ method: "GET", url: "/super-admin/finance/withdrawals", params: { page, limit } }),
  initiate: (input: InitiateCentralPayoutInput) =>
    apiRequest<CentralPayoutOperation>({
      method: "POST",
      url: "/super-admin/finance/withdrawals",
      data: input,
    }),
  syncProviderHistory: (maxPages?: number) =>
    apiRequest<HistorySyncResult>({
      method: "POST",
      url: "/super-admin/finance/withdrawals/provider-history/sync",
      data: maxPages ? { maxPages } : {},
    }),
  refresh: (operationId: string) =>
    apiRequest<CentralPayoutOperation>({
      method: "POST",
      url: `/super-admin/finance/withdrawals/${operationId}/refresh`,
    }),
};
