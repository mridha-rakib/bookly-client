"use client";

import React, { useMemo, useState } from "react";
import PlatformBankAccount from "./PlatformBankAccount";
import { toUserMessage } from "@/lib/auth/messages";
import { BooklyApiError } from "@/lib/api/client";
import type {
  CentralBankDestination,
  CentralPayoutOperation,
  CentralPayoutOverview,
  CentralStripeMode,
  CurrencyEligibility,
  ObservedPayout,
  ObservedPayoutFilters,
  PayoutLinkage,
  ProviderPayoutStatus,
} from "@/lib/api/centralPayouts";
import {
  useCentralPayoutOverviewQuery,
  useCentralPayoutsQuery,
  useInitiateCentralPayoutMutation,
  useObservedPayoutsQuery,
  useRefreshCentralPayoutMutation,
  useSyncProviderPayoutHistoryMutation,
  useWithdrawalEligibilityQuery,
} from "@/lib/superAdminFinance/hooks";

/** Minor-unit digits for a currency, from Intl (EUR → 2, JPY → 0). */
const fractionDigits = (currency: string): number =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() })
    .resolvedOptions().maximumFractionDigits ?? 2;

const formatMinor = (amount: number, currency: string): string => {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
};

/** Parses "200" / "200.5" / "200.50" into integer minor units without floating-point maths. */
const parseMinor = (value: string, currency: string): number | null => {
  const digits = fractionDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^(\\d+)(?:[.,](\\d{1,${digits}}))?$`);
  const match = value.trim().match(pattern);
  if (!match) return null;
  const whole = match[1] ?? match[0];
  const fraction = (match[2] ?? "").padEnd(digits, "0");
  const minor = Number(whole) * 10 ** digits + (digits ? Number(fraction) : 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
};

const formatDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
    : "—";

const formatDay = (iso: string | null): string =>
  iso ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso)) : "—";

const maskedBank = (d: { bankName: string | null; last4: string }) =>
  `${d.bankName ?? "Bank account"} •••• ${d.last4}`;

/** What the Super Admin sees for each state. Stripe "paid" is reported, not a bank guarantee. */
const statusLabel = (op: CentralPayoutOperation): { text: string; tone: string } => {
  if (op.state === "PREPARED") return { text: "Not yet sent", tone: "bg-gray-100 text-gray-700" };
  if (op.state === "UNKNOWN")
    return { text: "Awaiting Stripe confirmation", tone: "bg-amber-50 text-amber-700" };
  if (op.state === "REJECTED") return { text: "Not created", tone: "bg-rose-50 text-rose-700" };
  switch (op.providerStatus) {
    case "pending":
      return { text: "Pending", tone: "bg-amber-50 text-amber-700" };
    case "in_transit":
      return { text: "In transit", tone: "bg-sky-50 text-sky-700" };
    case "paid":
      return { text: "Paid (reported by Stripe)", tone: "bg-emerald-50 text-emerald-700" };
    case "failed":
      return { text: "Failed", tone: "bg-rose-50 text-rose-700" };
    case "canceled":
      return { text: "Canceled", tone: "bg-gray-100 text-gray-700" };
    default:
      return { text: "Unknown", tone: "bg-gray-100 text-gray-700" };
  }
};

const isFinal = (op: CentralPayoutOperation) =>
  op.state === "REJECTED" || op.providerStatus === "failed" || op.providerStatus === "canceled";

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-[0px_2px_8px_rgba(0,0,0,0.03)] p-5 ${className}`}>
    {children}
  </div>
);

export default function SuperAdminWithdrawals() {
  const overviewQuery = useCentralPayoutOverviewQuery();
  const overview = overviewQuery.data;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-lg text-[#111827]">Withdrawals</h3>
          <span className="text-sm text-[#4E5F78]">
            Bookly&apos;s platform bank account, Stripe balances and withdrawal status
          </span>
        </div>
        {overview?.mode && (
          <span
            className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold ${
              overview.mode === "LIVE" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"
            }`}
          >
            {overview.mode === "LIVE" ? "LIVE Stripe account" : "TEST mode — no real money moves"}
          </span>
        )}
      </div>

      <PlatformBankAccount />

      {overviewQuery.isLoading ? (
        <Card>
          <span className="text-sm text-gray-500">Loading Stripe balance…</span>
        </Card>
      ) : overviewQuery.isError || !overview ? (
        <Card>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-rose-600">
              {toUserMessage(overviewQuery.error)}
            </span>
            <button
              type="button"
              onClick={() => overviewQuery.refetch()}
              className="self-start border border-[#111111] text-[#111111] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              Try again
            </button>
          </div>
        </Card>
      ) : (
        <>
          <BalanceCards overview={overview} />
          <WithdrawalForm key={overview.balances.map((b) => b.currency).join(",")} overview={overview} />
          <StripePayoutHistory overview={overview} />
          <ReconciliationReadinessCard overview={overview} />
          {overview.reconciliation && overview.mode && <ObservedPayoutReview currentMode={overview.mode} />}
        </>
      )}

      <WithdrawalHistory />
    </div>
  );
}

function BalanceCards({ overview }: { overview: CentralPayoutOverview }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-lg text-[#111827]">Stripe balance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {overview.balances.length === 0 && (
          <Card>
            <span className="text-sm text-gray-500">Stripe reported no balance.</span>
          </Card>
        )}
        {overview.balances.map((balance) => {
          const inProgress = overview.payoutsInProgress.find((p) => p.currency === balance.currency);
          return (
            <Card key={balance.currency}>
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {balance.currency.toUpperCase()} Stripe balance
                </span>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold text-[#111827]">
                    {formatMinor(balance.availableCents, balance.currency)}
                  </span>
                  <span className="text-xs text-gray-500">Available</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#314158]">
                      {formatMinor(balance.pendingCents, balance.currency)}
                    </span>
                    <span className="text-xs text-gray-500">Pending (not yet available)</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-[#314158]">
                      {formatMinor(inProgress?.amountCents ?? 0, balance.currency)}
                    </span>
                    <span className="text-xs text-gray-500">Recent payouts pending / in transit (up to 100)</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 text-xs text-[#5B5D58] font-medium leading-[18px]">
        The Stripe available balance is not the same as Bookly&apos;s own money. It includes
        Business-owned deposits, cancellation and no-show fees
        {overview.businessAttributedUnpaid
          ? ` (${formatMinor(overview.businessAttributedUnpaid.amountCents, overview.businessAttributedUnpaid.currency)} recorded as not yet paid out to Businesses)`
          : ""}
        , and funds needed for refunds or disputes. The eligible withdrawal amount below is
        calculated by Bookly&apos;s server from the ledger and Stripe evidence. Withdrawing moves cash
        to the company bank; it never turns Business money into Bookly revenue or reduces what is
        owed to Businesses.
      </div>
    </div>
  );
}

function WithdrawalForm({ overview }: { overview: CentralPayoutOverview }) {
  const mutation = useInitiateCentralPayoutMutation();
  const eligibilityQuery = useWithdrawalEligibilityQuery();
  const currencies = overview.balances.map((b) => b.currency);
  const [currency, setCurrency] = useState(currencies[0] ?? "eur");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Created once per review; a resubmission of the same confirmation reuses it server-side.
   * Bound to the reviewed eligibility digest: a changed evaluation requires a new review. */
  const [review, setReview] = useState<{ requestId: string; amountMinor: number; destination: CentralBankDestination; digest: string } | null>(null);
  const [result, setResult] = useState<CentralPayoutOperation | null>(null);
  const decision = eligibilityQuery.data?.currencies.find((c) => c.currency === currency);
  const eligible = decision?.status === "AVAILABLE" ? decision.eligibleCents : 0;
  const staleReview = Boolean(review && decision && decision.digest !== review.digest);

  const destination = useMemo(
    () => {
      const matches = overview.destinations.filter((d) => d.eligible && d.defaultForCurrency === true && d.currency === currency);
      return matches.length === 1 ? matches[0] : undefined;
    },
    [overview.destinations, currency],
  );
  const blocked =
    overview.restrictions.length > 0 ||
    (overview.mode === "LIVE" && !overview.liveExecutionEnabled) ||
    decision?.status !== "AVAILABLE";

  const startReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked || !decision) return setError("Withdrawal authority is unavailable. Review the restrictions above.");
    setError(null);
    setResult(null);
    const amountMinor = parseMinor(amount, currency);
    if (amountMinor === null) return setError("Enter a valid amount, for example 200.00.");
    if (amountMinor > eligible)
      return setError(`The amount is more than the eligible ${formatMinor(eligible, currency)}.`);
    if (!destination) return setError("No usable bank account is linked for this currency.");
    setReview({ requestId: crypto.randomUUID(), amountMinor, destination, digest: decision.digest });
  };

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (blocked) return setError("Withdrawal authority is unavailable. Review the restrictions above.");
    if (staleReview) return setError("The eligible amount changed since your review. Review the withdrawal again.");
    if (!review || mutation.isPending) return;
    setError(null);
    mutation.mutate(
      {
        requestId: review.requestId,
        amountCents: review.amountMinor,
        currency,
        destinationId: review.destination.id,
        currentPassword: password,
        eligibilityDigest: review.digest,
      },
      {
        onSuccess: (op) => {
          setResult(op);
          setReview(null);
          setAmount("");
          setPassword("");
        },
        // The same requestId is kept, so retrying after a timeout cannot create a second payout.
        // Changed or unavailable eligibility needs a fresh review against the new evaluation.
        onError: (err) => {
          setError(toUserMessage(err));
          if (err instanceof BooklyApiError && err.code?.startsWith("CENTRAL_PAYOUT_ELIGIBILITY_")) {
            setReview(null);
            setPassword("");
          }
        },
      },
    );
  };

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-semibold text-sm text-[#111827]">Central withdrawal eligibility</h3>
          <span className="text-xs text-gray-500">
            Destination:{" "}
            {destination ? (
              <span className="font-medium text-[#314158]">
                {maskedBank(destination)} ({destination.currency.toUpperCase()}, {destination.status})
              </span>
            ) : (
              <span className="font-medium text-rose-600">No confirmed usable default for this currency. Review the bank summary and Stripe.</span>
            )}
          </span>
        </div>

        <EligibilityPanel
          currency={currency}
          decision={decision}
          evaluatedAt={eligibilityQuery.data?.evaluatedAt ?? null}
          loading={eligibilityQuery.isLoading}
          error={eligibilityQuery.isError ? toUserMessage(eligibilityQuery.error) : null}
          onRetry={() => void eligibilityQuery.refetch()}
        />

        {overview.restrictions.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Withdrawal restrictions">
            {overview.restrictions.map((r) => (
              <li key={r.code} className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 font-medium">
                {r.message}
              </li>
            ))}
          </ul>
        )}

        {result && (
          <div role="status" className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 font-medium flex flex-col gap-1">
            <span>
              Withdrawal of {formatMinor(result.amountCents, result.currency)} submitted — status:{" "}
              {statusLabel(result).text}.
            </span>
            <span>
              Stripe reference: {result.providerPayoutId ?? "awaiting confirmation"} · Bookly reference: {result.id}
            </span>
          </div>
        )}

        {!review ? (
          <form onSubmit={startReview} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[0.8px] uppercase text-[#6B7280]">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={blocked}
                className="h-10 border border-[#D3D1C7] rounded-[8px] px-3 text-sm bg-white disabled:bg-neutral-50"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-[0.8px] uppercase text-[#6B7280]">
                Amount (eligible {formatMinor(eligible, currency)})
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={blocked}
                placeholder="0.00"
                className="h-10 border border-[#D3D1C7] rounded-[8px] px-3.5 text-sm disabled:bg-neutral-50"
              />
            </label>
            <button
              type="submit"
              disabled={blocked || !destination}
              className="h-10 bg-[#111111] hover:bg-black text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review withdrawal
            </button>
          </form>
        ) : (
          <form onSubmit={confirm} className="flex flex-col gap-4 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-[#111827]">
              Withdraw {formatMinor(review.amountMinor, currency)} to the linked bank account ending in{" "}
              {review.destination.last4}.
            </p>
            <p className="text-xs text-gray-500">
              {overview.mode === "LIVE"
                ? "This moves real money from Bookly's LIVE Stripe balance."
                : "TEST mode: Stripe simulates this payout; no real money moves."}{" "}
              Fees and arrival date are shown once Stripe reports them. Bookly re-checks the eligible
              amount immediately before sending; if it no longer covers this amount, nothing is sent.
            </p>
            {staleReview && (
              <p role="alert" className="text-xs font-semibold text-amber-700">
                The eligible amount changed since your review. Cancel and review the withdrawal again.
              </p>
            )}
            <label className="flex flex-col gap-1 max-w-sm">
              <span className="text-[10px] font-semibold tracking-[0.8px] uppercase text-[#6B7280]">
                Your current password
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={mutation.isPending}
                className="h-10 border border-[#D3D1C7] rounded-[8px] px-3.5 text-sm"
              />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                disabled={blocked || staleReview || mutation.isPending || !password}
                className="h-10 bg-[#111111] hover:bg-black text-white px-4 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? "Submitting…" : "Confirm withdrawal"}
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => {
                  setReview(null);
                  setPassword("");
                  setError(null);
                }}
                className="h-10 border border-[#DEDDE3] px-4 rounded-lg text-sm font-semibold text-[#111111] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>
    </Card>
  );
}

/**
 * CW-1 — the server's eligibility decision for one currency, displayed as calculated (never
 * recomputed here): the cash and ledger caps, the protected refund/dispute amounts, the
 * Bookly-owned vs Business-owned distinction, and every reason it is unavailable.
 */
function EligibilityPanel({
  currency,
  decision,
  evaluatedAt,
  loading,
  error,
  onRetry,
}: {
  currency: string;
  decision: CurrencyEligibility | undefined;
  evaluatedAt: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) return <p className="text-xs text-gray-500">Calculating the eligible withdrawal amount…</p>;
  if (error)
    return (
      <div role="alert" className="text-xs text-rose-600">
        Eligible amount unavailable: {error}{" "}
        <button type="button" onClick={onRetry} className="underline">Retry</button>
      </div>
    );
  if (!decision)
    return <p className="text-xs text-gray-500">No eligibility was calculated for {currency.toUpperCase()}.</p>;
  const money = (cents: number | null) => (cents === null ? "Not available" : formatMinor(cents, currency));
  const row = (label: string, value: string, emphasis = false) => (
    <div key={label} className="flex justify-between gap-3">
      <span className={emphasis ? "font-semibold text-[#111827]" : "text-gray-500"}>{label}</span>
      <span className={`whitespace-nowrap ${emphasis ? "font-semibold text-[#111827]" : "font-medium text-[#314158]"}`}>{value}</span>
    </div>
  );
  const p = decision.protected;
  return (
    <section aria-label="Withdrawal eligibility" className="border border-gray-100 rounded-lg p-4 flex flex-col gap-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <span className="font-semibold text-sm text-[#111827]">
          {decision.status === "AVAILABLE"
            ? `Eligible to withdraw now: ${formatMinor(decision.eligibleCents, currency)}`
            : "Eligible amount unavailable"}
        </span>
        {evaluatedAt && <span className="text-gray-500">Calculated {formatDate(evaluatedAt)}</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          {row("Stripe available", money(decision.stripeAvailableCents))}
          {row("Cash Bookly's ledger attributes to Stripe", money(decision.ledgerHeldCents))}
          {row("Protected: refunds in progress", money(p.refundsInProgressCents))}
          {row("Protected: refundable bookings", money(p.refundableBookingsCents))}
          {row("Protected: refundable packages", money(p.refundablePackagesCents))}
          {row("Protected: disputes not yet debited", money(p.disputesCents))}
          {row("Eligible (lower of the two, minus protected)", money(decision.eligibleCents), true)}
        </div>
        <div className="flex flex-col gap-1.5">
          {row("Bookly net platform-fee revenue (recorded)", money(decision.ledger.booklyNetRevenueCents))}
          {row("Business-owned funds (recorded)", money(decision.ledger.businessOwnedNetCents))}
          {row("Recorded transfers to Businesses", money(decision.ledger.businessSettledCents))}
          {row("Still owed to Businesses", money(decision.ledger.businessOutstandingCents))}
          {decision.ledger.taxLiabilityCents > 0 && row("Recorded tax liability", money(decision.ledger.taxLiabilityCents))}
          {row("Already paid out of Stripe", money(decision.ledger.stripePayoutsOutCents))}
          <span className="text-gray-500">
            Business-owned money may be moved to the company bank, but it is never Bookly revenue. What is still owed to
            Businesses stays owed until each bank transfer is recorded.
          </span>
        </div>
      </div>
      {decision.blockers.length > 0 && (
        <ul aria-label="Eligibility blockers" className="flex flex-col gap-1.5">
          {decision.blockers.map((b) => (
            <li key={b.code} className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-amber-800 font-medium">
              {b.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stripe's reported status for a payout of any origin. "Paid" is Stripe's report, not a bank
 * statement entry. */
const providerStatusLabel = (status: string): { text: string; tone: string } => {
  switch (status) {
    case "pending":
      return { text: "Pending", tone: "bg-amber-50 text-amber-700" };
    case "in_transit":
      return { text: "In transit", tone: "bg-sky-50 text-sky-700" };
    case "paid":
      return { text: "Paid (reported by Stripe)", tone: "bg-emerald-50 text-emerald-700" };
    case "failed":
      return { text: "Failed", tone: "bg-rose-50 text-rose-700" };
    case "canceled":
      return { text: "Canceled", tone: "bg-gray-100 text-gray-700" };
    default:
      return { text: status || "Unknown", tone: "bg-gray-100 text-gray-700" };
  }
};

/**
 * FG03B-0 — read-only list of the most recent Stripe payouts, including ones not requested
 * through Bookly. Origin is shown as "Bookly withdrawal" only when the API verified the link;
 * everything else is "Origin not verified", never "unauthorized". The list is a bounded sample,
 * so a payout missing from it proves nothing.
 */
function StripePayoutHistory({ overview }: { overview: CentralPayoutOverview }) {
  const rows = overview.recentStripePayouts ?? [];
  const scope = overview.recentStripePayoutsScope;
  const unverified = rows.filter((p) => p.origin !== "BOOKLY_WITHDRAWAL").length;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-0.5">
        <span className="font-semibold text-sm text-[#111827]">Recent Stripe payouts</span>
        <span className="text-xs text-gray-500">
          As reported by Stripe, from any origin: Bookly withdrawals, Stripe Dashboard payouts and automatic payouts. Read-only.
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">
          Stripe returned no recent payouts. This does not prove that no payouts were made.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[820px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                {["Stripe payout", "Amount", "Created", "Status", "Est. arrival", "Type", "Destination", "Origin"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#314158]">
              {rows.map((p) => {
                const status = providerStatusLabel(p.status);
                const verified = p.origin === "BOOKLY_WITHDRAWAL";
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3 font-mono">{p.id}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatMinor(p.amountCents, p.currency)}
                      {p.livemode === false && <span className="ml-1 text-[10px] text-sky-700">TEST</span>}
                      {p.livemode === true && <span className="ml-1 text-[10px] text-rose-700">LIVE</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.created)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${status.tone}`}>{status.text}</span>
                      {p.failureCode && <p className="mt-1 text-rose-600 font-mono">{p.failureCode}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.arrivalDate ? formatDay(p.arrivalDate) : "Not provided"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.automatic ? "Automatic (Stripe schedule)" : "Manual"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.destinationLast4 ? `•••• ${p.destinationLast4}` : "Not shown"}</td>
                    <td className="px-4 py-3">
                      {verified ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap bg-emerald-50 text-emerald-700 self-start">Bookly withdrawal</span>
                          {p.booklyOperationId && <span className="font-mono text-[10px] text-gray-500">Ref {p.booklyOperationId}</span>}
                        </span>
                      ) : p.origin === "LINKAGE_UNRESOLVED" ? (
                        <span className="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap bg-amber-50 text-amber-700">Linkage unresolved</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap bg-gray-100 text-gray-700">Origin not verified</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex flex-col gap-1 text-xs text-gray-500">
        <span>
          {scope
            ? `Showing the ${scope.shown} most recent of ${scope.returnedByStripe} payouts Stripe returned (Bookly requests at most ${scope.requestLimit}). Older payouts are not shown, so this is not a complete payout history.`
            : "This list covers only Stripe's most recent payouts. It is not a complete payout history."}
        </span>
        {unverified > 0 && (
          <span>
            &quot;Origin not verified&quot; means Bookly has no withdrawal record holding this Stripe payout. It may have been made in the Stripe Dashboard, by Stripe&apos;s automatic schedule, or be a Bookly withdrawal not yet linked. &quot;Linkage unresolved&quot; means the payout names a Bookly withdrawal that has not confirmed it yet. Neither is a finding that the payout was unauthorized.
          </span>
        )}
        <span>Stripe&apos;s &quot;Paid&quot; status and estimated arrival are Stripe&apos;s reports, not bank confirmation, and Stripe documents that a paid payout can later change to failed. Check the bank statement to confirm receipt.</span>
      </div>
    </Card>
  );
}

const coverageLabel: Record<string, string> = {
  NEVER_RUN: "Never read",
  IN_PROGRESS: "Incomplete",
  COMPLETE: "Complete",
};

/**
 * FG03B-1 — read-only payout-evidence status. "Evidence complete" is never shown as permission
 * to withdraw; the history read control appears only when the deployment enables it.
 */
function ReconciliationReadinessCard({ overview }: { overview: CentralPayoutOverview }) {
  const readiness = overview.reconciliation;
  const sync = useSyncProviderPayoutHistoryMutation();
  if (!readiness) {
    return (
      <Card>
        <span className="text-sm text-gray-500">Payout reconciliation status is not available from this server.</span>
      </Card>
    );
  }
  const { coverage, observations } = readiness;
  const status = readiness.evidenceComplete
    ? { text: "Provider evidence complete", tone: "bg-emerald-50 text-emerald-700" }
    : readiness.reviewNeeded
      ? { text: "Review needed", tone: "bg-amber-50 text-amber-700" }
      : { text: "Evidence incomplete", tone: "bg-gray-100 text-gray-700" };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-sm text-[#111827]">Payout reconciliation</span>
          <span className="text-xs text-gray-500">
            Whether Bookly holds complete, linked evidence of every Stripe payout. This is not permission to withdraw.
          </span>
        </div>
        <span className={`self-start sm:self-auto px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${status.tone}`}>{status.text}</span>
      </div>
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#314158]">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stripe history coverage</span>
          <span className="font-medium">{coverageLabel[coverage.state] ?? coverage.state}</span>
          {coverage.state === "COMPLETE" && coverage.completeAsOf && (
            <span className="text-xs text-gray-500">
              {readiness.freshness?.statusVerifiedAsOf
                ? `Every payout status re-verified by a full Stripe read on ${formatDate(readiness.freshness.statusVerifiedAsOf)}.`
                : `Read through ${formatDate(coverage.completeAsOf)}.`}{" "}
              Later payouts and status changes rely on webhook delivery until the next full read.
            </span>
          )}
          {coverage.runInProgress && (
            <span className="text-xs text-gray-500">
              {coverage.state === "COMPLETE" ? "Re-verification" : "Read"} in progress: {coverage.runInProgress.pages} page(s), {coverage.runInProgress.observed} payout(s) so far.
            </span>
          )}
          {readiness.freshness?.verificationStale && (
            <span className="text-xs text-amber-700">
              Payout statuses were last re-verified more than {readiness.freshness.freshnessTargetHours} hours ago. Read the history again to refresh the evidence.
            </span>
          )}
          {coverage.lastRunAt && <span className="text-xs text-gray-500">Last read started {formatDate(coverage.lastRunAt)}</span>}
          {coverage.accountMatches === false && (
            <span className="text-xs text-rose-600">The connected Stripe account differs from the one the history was read from.</span>
          )}
        </div>
        {readiness.accountVerified === false ? (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observed Stripe payouts</span>
            <span className="text-rose-600">
              Counts unavailable: the current Stripe account could not be identified, so no payout evidence is counted.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observed Stripe payouts ({observations.total})</span>
            <span>{observations.verifiedBookly} linked to a Bookly withdrawal</span>
            <span>{observations.notVerified} origin not verified</span>
            <span>{observations.unresolved} linkage unresolved</span>
            <span>{observations.inFlight} pending or in transit</span>
            {observations.reportedPaid !== undefined && (
              <span>{observations.reportedPaid} reported paid by Stripe (not bank-confirmed; can still change to failed)</span>
            )}
            {observations.stale !== undefined && observations.stale > 0 && (
              <span className="text-amber-700">{observations.stale} not re-confirmed by Stripe recently</span>
            )}
            {observations.notReconfirmed !== undefined && observations.notReconfirmed > 0 && (
              <span className="text-amber-700">{observations.notReconfirmed} not listed by the last full Stripe read</span>
            )}
            {observations.statusConflicts !== undefined && observations.statusConflicts > 0 && (
              <span className="text-rose-600">{observations.statusConflicts} with a status Stripe&apos;s current list contradicts</span>
            )}
            {readiness.unresolvedWithdrawalOperations > 0 && (
              <span>{readiness.unresolvedWithdrawalOperations} Bookly withdrawal(s) awaiting Stripe confirmation</span>
            )}
            {observations.otherAccounts !== undefined && observations.otherAccounts > 0 && (
              <span className="text-xs text-gray-500">
                {observations.otherAccounts} record(s) from a previously connected Stripe account are kept but not counted.
              </span>
            )}
          </div>
        )}
      </div>
      {readiness.finality && (
        <p className="px-5 pb-3 text-xs text-[#5B5D58]">
          <span className="font-semibold text-[#314158]">Financial finality: not established.</span> {readiness.finality.message}
        </p>
      )}
      {readiness.blockers.length > 0 && (
        <ul aria-label="Reconciliation gaps" className="px-5 pb-4 flex flex-col gap-1.5 text-xs text-[#5B5D58]">
          {readiness.blockers.map((b) => (
            <li key={b.code} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{b.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500">
        {readiness.syncEnabled ? (
          <>
            <button
              type="button"
              disabled={sync.isPending}
              onClick={() => sync.mutate(undefined)}
              className="self-start border border-[#111111] text-[#111111] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {sync.isPending ? "Reading Stripe history…" : "Read Stripe payout history"}
            </button>
            <span>
              {sync.isError
                ? toUserMessage(sync.error)
                : sync.data
                  ? `Read ${sync.data.pagesThisCall} page(s), ${sync.data.observedThisCall} payout(s): ${sync.data.state === "COMPLETE" ? "history complete." : "history still incomplete; run again to continue."}`
                  : "Reads a bounded number of Stripe pages per click. It never moves money."}
            </span>
          </>
        ) : (
          <span>Reading the full Stripe payout history is not enabled in this deployment.</span>
        )}
      </div>
    </Card>
  );
}

const linkageBadge: Record<PayoutLinkage, { text: string; tone: string }> = {
  VERIFIED_BOOKLY: { text: "Bookly withdrawal", tone: "bg-emerald-50 text-emerald-700" },
  UNRESOLVED: { text: "Linkage unresolved", tone: "bg-amber-50 text-amber-700" },
  NOT_VERIFIED: { text: "Origin not verified", tone: "bg-gray-100 text-gray-700" },
};
const selectClass = "border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-[#314158] bg-white";

/** FG03B-3 — whether Bookly's record of the Stripe status is currently verified (not finality). */
const statusEvidenceLabel = (p: ObservedPayout): { text: string; tone: string } => {
  switch (p.statusVerification) {
    case "CONFLICT":
      return { text: `Stripe list now says ${providerStatusLabel(p.listedStatusConflict ?? "").text}`, tone: "text-rose-600" };
    case "NOT_RECONFIRMED":
      return { text: "Not in last full Stripe read", tone: "text-amber-700" };
    case "STALE":
      return { text: "Stale: re-read needed", tone: "text-amber-700" };
    default:
      return { text: "Verified current", tone: "text-emerald-700" };
  }
};

/**
 * FG03B-2 — read-only review of every Stripe payout Bookly has observed (beyond the recent sample),
 * served from Bookly's records for the current verified Stripe account. Provider evidence only:
 * it is not Bookly's money ledger and offers no approve / assign / withdraw action.
 */
function ObservedPayoutReview({ currentMode }: { currentMode: CentralStripeMode }) {
  const limit = 20;
  const [filters, setFilters] = useState<Omit<ObservedPayoutFilters, "page" | "limit">>({});
  const [page, setPage] = useState(1);
  const query = useObservedPayoutsQuery({ ...filters, page, limit });
  const data = query.data;
  const rows = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const update = (next: Partial<typeof filters>) => {
    setFilters((current) => {
      const merged = { ...current, ...next };
      for (const key of Object.keys(merged) as (keyof typeof merged)[])
        if (merged[key] === undefined || merged[key] === "" || merged[key] === false) delete merged[key];
      return merged;
    });
    setPage(1);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-0.5">
        <span className="font-semibold text-sm text-[#111827]">Observed Stripe payouts</span>
        <span className="text-xs text-gray-500">
          Provider evidence Bookly has recorded from Stripe for the current Stripe account. This is not Bookly&apos;s money ledger, and nothing here approves, assigns or moves money.
        </span>
      </div>
      <div role="group" aria-label="Payout filters" className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 text-xs">
        <select aria-label="Linkage" className={selectClass} value={filters.linkage ?? ""} onChange={(e) => update({ linkage: (e.target.value || undefined) as PayoutLinkage | undefined })}>
          <option value="">All linkage</option>
          <option value="NOT_VERIFIED">Origin not verified</option>
          <option value="UNRESOLVED">Linkage unresolved</option>
          <option value="VERIFIED_BOOKLY">Bookly withdrawal</option>
        </select>
        <select aria-label="Stripe status" className={selectClass} value={filters.status ?? ""} onChange={(e) => update({ status: (e.target.value || undefined) as ProviderPayoutStatus | undefined })}>
          <option value="">All statuses</option>
          {(["pending", "in_transit", "paid", "failed", "canceled"] as const).map((s) => (
            <option key={s} value={s}>{providerStatusLabel(s).text}</option>
          ))}
        </select>
        <select aria-label="Mode" className={selectClass} value={filters.mode ?? currentMode} onChange={(e) => update({ mode: e.target.value === currentMode ? undefined : (e.target.value as CentralStripeMode) })}>
          <option value="TEST">TEST</option>
          <option value="LIVE">LIVE</option>
        </select>
        <label className="flex items-center gap-1 text-gray-500">
          From
          <input type="date" aria-label="Created from" className={selectClass} value={filters.from ?? ""} max={filters.to} onChange={(e) => update({ from: e.target.value || undefined })} />
        </label>
        <label className="flex items-center gap-1 text-gray-500">
          To
          <input type="date" aria-label="Created to" className={selectClass} value={filters.to ?? ""} min={filters.from} onChange={(e) => update({ to: e.target.value || undefined })} />
        </label>
        <label className="flex items-center gap-1.5 text-[#314158]">
          <input type="checkbox" checked={filters.needsReview === true} onChange={(e) => update({ needsReview: e.target.checked })} />
          Needs financial review only
        </label>
      </div>
      {query.isLoading ? (
        <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>
      ) : query.isError ? (
        <div role="alert" className="px-5 py-6 text-sm text-rose-600">
          {toUserMessage(query.error)}{" "}
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">
          No observed payouts match these filters. Bookly only holds payouts it has read from Stripe, so this does not prove that none were made.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[960px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                {["Stripe payout", "Amount", "Created", "Stripe-reported status", "Status evidence", "Destination", "Linkage", "Last confirmed by Stripe"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#314158]">
              {rows.map((p) => {
                const status = providerStatusLabel(p.status);
                const link = linkageBadge[p.linkage] ?? linkageBadge.NOT_VERIFIED;
                return (
                  <tr key={`${p.mode}:${p.providerPayoutId}`} className="align-top">
                    <td className="px-4 py-3 font-mono">
                      {p.providerPayoutId}
                      {p.reviewReasons.length > 0 && <p className="mt-1 font-sans text-[10px] font-semibold text-amber-700">Needs review</p>}
                    </td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatMinor(p.amountCents, p.currency)}
                      <span className={`ml-1 text-[10px] ${p.mode === "LIVE" ? "text-rose-700" : "text-sky-700"}`}>{p.mode}</span>
                      <p className="font-normal text-gray-500">{p.automatic ? "Automatic" : "Manual"}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.created)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${status.tone}`}>{status.text}</span>
                      {p.failureCode && <p className="mt-1 text-rose-600 font-mono">{p.failureCode}</p>}
                      {p.providerLifecycle === "REPORTED_PAID" && (
                        <p className="mt-1 text-gray-500 whitespace-nowrap">Not bank-confirmed; can still fail</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const evidence = statusEvidenceLabel(p);
                        return <span className={`font-semibold whitespace-nowrap ${evidence.tone}`}>{evidence.text}</span>;
                      })()}
                      <p className="mt-1 text-gray-500 whitespace-nowrap">
                        {p.lastListedAt ? `Last full read ${formatDate(p.lastListedAt)}` : "Never in a full read"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.destinationLast4 ? `•••• ${p.destinationLast4}` : "Not recorded"}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-col gap-0.5">
                        <span className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap self-start ${link.tone}`}>{link.text}</span>
                        {p.booklyOperationId && <span className="font-mono text-[10px] text-gray-500">Ref {p.booklyOperationId}</span>}
                        {p.namedOperationId && <span className="font-mono text-[10px] text-gray-500">Names {p.namedOperationId} (unconfirmed)</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(p.lastVerifiedAt)}
                      <p className="text-gray-500">{p.lastVerifiedVia === "WEBHOOK" ? "By webhook" : "By history read"}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs text-gray-500">
        <div className="flex flex-col gap-1">
          {data && (
            <>
              <span>
                {data.evidence.statusVerifiedAsOf
                  ? `All payout statuses re-verified by a full Stripe read on ${formatDate(data.evidence.statusVerifiedAsOf)}${data.evidence.verificationStale ? " (more than 24 hours ago: newer payouts or status changes may be missing)" : ""}.`
                  : data.evidence.coverageState === "IN_PROGRESS"
                    ? "Stripe history read is incomplete: older payouts may be missing from this list."
                    : data.evidence.coverageState === "COMPLETE"
                      ? "The last full Stripe read does not apply to the current account: statuses are not re-verified."
                      : "Stripe history has never been fully read: this list holds only payouts seen by webhook."}
              </span>
              {data.evidence.verificationInProgress && <span>A full re-verification read is in progress.</span>}
              {data.evidence.lastError && (
                <span className="text-amber-700">The last Stripe read stopped: {data.evidence.lastError}</span>
              )}
              {data.evidence.coverageAccountMatches === false && (
                <span className="text-rose-600">The history was read from a different Stripe account.</span>
              )}
              {!data.modeIsCurrent && (
                <span>{data.mode} records shown; the configured Stripe key is {currentMode}.</span>
              )}
              {data.evidence.otherAccountObservations > 0 && (
                <span>{data.evidence.otherAccountObservations} record(s) from a previously connected Stripe account are excluded.</span>
              )}
            </>
          )}
          <span>
            Unverified or unresolved payouts stay unassigned until an approved financial-review policy exists. Neither is a finding that a payout was unauthorized.
          </span>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span>
              Page {page} of {Math.max(1, Math.ceil(total / limit))} · {total} record(s)
            </span>
            <button type="button" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)} className="border px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={page * limit >= total || query.isFetching} onClick={() => setPage(page + 1)} className="border px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function WithdrawalHistory() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const query = useCentralPayoutsQuery(page, limit);
  const refresh = useRefreshCentralPayoutMutation();
  const rows = query.data?.withdrawals ?? [];
  const total = query.data?.pagination.total ?? 0;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-0.5">
        <span className="font-semibold text-sm text-[#111827]">Withdrawal history</span>
        <span className="text-xs text-gray-500">Withdrawals requested through Bookly. Stripe&apos;s own payout list is shown separately above.</span>
      </div>
      {query.isLoading ? (
        <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>
      ) : query.isError ? (
        <div role="alert" className="px-5 py-6 text-sm text-rose-600">
          {toUserMessage(query.error)}{" "}
          <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className="underline">Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No withdrawals yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide">
              <tr>
                {["Stripe payout", "Amount", "Requested", "Destination", "Status", "Est. arrival", "Initiated by", "Bookly ref", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[#314158]">
              {rows.map((op) => {
                const status = statusLabel(op);
                return (
                  <tr key={op.id} className="align-top">
                    <td className="px-4 py-3 font-mono">{op.providerPayoutId ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {formatMinor(op.amountCents, op.currency)}
                      {op.mode === "TEST" && <span className="ml-1 text-[10px] text-sky-700">TEST</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(op.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{maskedBank(op.destination)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${status.tone}`}>{status.text}</span>
                      {op.failureMessage && <p className="mt-1 text-rose-600 max-w-[220px]">{op.failureMessage}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDay(op.estimatedArrivalAt)}</td>
                    <td className="px-4 py-3">{op.initiatedBy.email}</td>
                    <td className="px-4 py-3 font-mono">{op.id}</td>
                    <td className="px-4 py-3">
                      {!isFinal(op) && (
                        <button
                          type="button"
                          disabled={refresh.isPending}
                          onClick={() => refresh.mutate(op.id)}
                          className="border border-[#111111] px-2.5 py-1 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50"
                        >
                          Refresh
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {refresh.isError && <p className="px-5 pb-3 text-xs text-rose-600">{toUserMessage(refresh.error)}</p>}
      {total > limit && (
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="border px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={page * limit >= total} onClick={() => setPage(page + 1)} className="border px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </Card>
  );
}
