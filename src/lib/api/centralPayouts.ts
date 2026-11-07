import { apiRequest } from "@/lib/api/client";

// P0.6 — Super Admin withdrawals from Bookly's central Stripe balance. Matches
// api/src/modules/central-payout/central-payout.route.ts. Amounts are integer minor units.

export type CentralStripeMode = "TEST" | "LIVE";
export type CentralPayoutState = "PREPARED" | "UNKNOWN" | "SUBMITTED" | "REJECTED";
export type ProviderPayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";

export interface CentralBankDestination {
  id: string;
  bankName: string | null;
  last4: string;
  currency: string;
  country: string;
  status: string;
  defaultForCurrency: boolean;
  eligible: boolean;
}

export interface CentralProviderPayout {
  id: string;
  amountCents: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  created: string;
  automatic: boolean;
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
  businessAttributedUnpaid: { currency: string; amountCents: number } | null;
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
  refresh: (operationId: string) =>
    apiRequest<CentralPayoutOperation>({
      method: "POST",
      url: `/super-admin/finance/withdrawals/${operationId}/refresh`,
    }),
};
