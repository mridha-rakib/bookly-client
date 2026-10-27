/** Additive Customer detail read contract. No command/provider credentials. */
export type PaymentProviderStatus = "NOT_CREATED" | "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
export type PaymentPersistenceStatus = "NOT_STARTED" | "PERSISTING" | "COMPLETED" | "FAILED";
export type PaymentCompensationStatus = "NOT_REQUIRED" | "REQUIRED" | "REFUND_PENDING" | "REFUNDED" | "RECONCILIATION_REQUIRED" | "FAILED";
export type RefundOperationStatus = "CREATED" | "PROVIDER_PENDING" | "SUCCEEDED" | "FAILED" | "RECONCILIATION_REQUIRED";
type BoundedRead<T> = { items: T[]; hasMore: boolean };
export type CustomerFinancialOutcome = {
  currency: "EUR";
  asOf: string;
  payments: BoundedRead<{
    id: string; providerStatus: PaymentProviderStatus; persistenceStatus: PaymentPersistenceStatus;
    compensationStatus: PaymentCompensationStatus; amountCents: number;
    providerConfirmed: boolean; accountingConfirmed: boolean; lastObservedAt?: string;
  }>;
  refunds: BoundedRead<{
    origin: "BOOKLY"; id: string; status: RefundOperationStatus; amountCents: number;
    providerCallStarted: boolean; providerConfirmed: boolean; accountingConfirmed: boolean; lastObservedAt?: string;
  } | {
    origin: "PROVIDER_EXTERNAL"; id: string; state: "ACCOUNTED"; amountCents: number;
    providerConfirmed: true; accountingConfirmed: true; providerCreatedAt?: string;
  }>;
  disputes: BoundedRead<{
    id: string; providerStatus: string; final: boolean;
    outcome?: "WON" | "LOST" | "PREVENTED" | "WARNING_CLOSED";
    amountCents: number; lastObservedAt: string;
  }>;
};
