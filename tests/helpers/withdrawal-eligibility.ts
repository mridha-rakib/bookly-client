import type { CurrencyEligibility, WithdrawalEligibility } from "@/lib/api/centralPayouts";

/** CW-1 — a server eligibility decision for client tests (the client only displays it). */
export const currencyEligibility = (over: Partial<CurrencyEligibility> = {}): CurrencyEligibility => ({
  currency: "eur",
  status: "AVAILABLE",
  eligibleCents: 10_000,
  stripeAvailableCents: 50_000,
  ledgerHeldCents: 130_000,
  protected: {
    refundsInProgressCents: 1_500,
    refundableBookingsCents: 30_000,
    refundablePackagesCents: 4_500,
    disputesCents: 4_000,
    totalCents: 40_000,
  },
  ledger: {
    stripeChargedCents: 135_000,
    stripeOutflowsCents: 5_000,
    stripePayoutsOutCents: 0,
    booklyNetRevenueCents: 97_000,
    businessOwnedNetCents: 40_000,
    businessSettledCents: 12_000,
    businessOutstandingCents: 28_000,
    taxLiabilityCents: 0,
  },
  blockers: [],
  digest: "a".repeat(64),
  ...over,
});

export const withdrawalEligibility = (
  currencies: CurrencyEligibility[] = [currencyEligibility()],
): WithdrawalEligibility => ({
  policyVersion: "CW-1",
  mode: "TEST",
  evaluatedAt: "2030-01-02T10:00:00.000Z",
  currencies,
  blockers: [],
});
