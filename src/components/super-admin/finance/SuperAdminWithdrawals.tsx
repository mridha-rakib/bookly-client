"use client";

import React, { useMemo, useState } from "react";
import { toUserMessage } from "@/lib/auth/messages";
import type {
  CentralBankDestination,
  CentralPayoutOperation,
  CentralPayoutOverview,
} from "@/lib/api/centralPayouts";
import {
  useCentralPayoutOverviewQuery,
  useCentralPayoutsQuery,
  useInitiateCentralPayoutMutation,
  useRefreshCentralPayoutMutation,
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
            Move funds from Bookly&apos;s Stripe balance to the bank account linked to that Stripe account
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
        </>
      )}

      <WithdrawalHistory />
    </div>
  );
}

function BalanceCards({ overview }: { overview: CentralPayoutOverview }) {
  return (
    <div className="flex flex-col gap-4">
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
                    <span className="text-xs text-gray-500">Payouts pending / in transit</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 text-xs text-[#5B5D58] font-medium leading-[18px]">
        The Stripe available balance is not the same as Bookly&apos;s own money. It can include
        cancellation and no-show fees attributed to Businesses
        {overview.businessAttributedUnpaid
          ? ` (${formatMinor(overview.businessAttributedUnpaid.amountCents, overview.businessAttributedUnpaid.currency)} recorded as not yet paid out to Businesses)`
          : ""}
        , and funds needed for refunds or disputes. Bookly has no approved withdrawable-amount
        policy, so a withdrawal is limited only by the Stripe available balance — check outstanding
        obligations first.
      </div>
    </div>
  );
}

function WithdrawalForm({ overview }: { overview: CentralPayoutOverview }) {
  const mutation = useInitiateCentralPayoutMutation();
  const currencies = overview.balances.map((b) => b.currency);
  const [currency, setCurrency] = useState(currencies[0] ?? "eur");
  const [amount, setAmount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Created once per review; a resubmission of the same confirmation reuses it server-side. */
  const [review, setReview] = useState<{ requestId: string; amountMinor: number; destination: CentralBankDestination } | null>(null);
  const [result, setResult] = useState<CentralPayoutOperation | null>(null);

  const destination = useMemo(
    () => overview.destinations.find((d) => d.eligible && d.currency === currency),
    [overview.destinations, currency],
  );
  const available = overview.balances.find((b) => b.currency === currency)?.availableCents ?? 0;
  const blocked = overview.restrictions.length > 0;

  const startReview = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    const amountMinor = parseMinor(amount, currency);
    if (amountMinor === null) return setError("Enter a valid amount, for example 200.00.");
    if (amountMinor > available)
      return setError(`The amount is more than the available ${formatMinor(available, currency)}.`);
    if (!destination) return setError("No usable bank account is linked for this currency.");
    setReview({ requestId: crypto.randomUUID(), amountMinor, destination });
  };

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!review || mutation.isPending) return;
    setError(null);
    mutation.mutate(
      {
        requestId: review.requestId,
        amountCents: review.amountMinor,
        currency,
        destinationId: review.destination.id,
        currentPassword: password,
      },
      {
        onSuccess: (op) => {
          setResult(op);
          setReview(null);
          setAmount("");
          setPassword("");
        },
        // The same requestId is kept, so retrying after a timeout cannot create a second payout.
        onError: (err) => setError(toUserMessage(err)),
      },
    );
  };

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-sm text-[#111827]">New withdrawal</span>
          <span className="text-xs text-gray-500">
            Destination:{" "}
            {destination ? (
              <span className="font-medium text-[#314158]">
                {maskedBank(destination)} ({destination.currency.toUpperCase()}, {destination.status})
              </span>
            ) : (
              <span className="font-medium text-rose-600">setup required in Stripe</span>
            )}
          </span>
        </div>

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
                Amount (available {formatMinor(available, currency)})
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
              Fees and arrival date are shown once Stripe reports them.
            </p>
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
                disabled={mutation.isPending || !password}
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

function WithdrawalHistory() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const query = useCentralPayoutsQuery(page, limit);
  const refresh = useRefreshCentralPayoutMutation();
  const rows = query.data?.withdrawals ?? [];
  const total = query.data?.pagination.total ?? 0;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <span className="font-semibold text-sm text-[#111827]">Withdrawal history</span>
      </div>
      {query.isLoading ? (
        <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>
      ) : query.isError ? (
        <p className="px-5 py-6 text-sm text-rose-600">{toUserMessage(query.error)}</p>
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
