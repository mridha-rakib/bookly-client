"use client";

import { useEffect, useRef, useState } from "react";

import { BooklyApiError } from "@/lib/api/client";
import type { LegacyPackageBalance } from "@/lib/api/packages";
import { toUserMessage } from "@/lib/auth/messages";
import { useAuthStore } from "@/lib/auth/store";
import { formatBookingDate, formatBookingMoney } from "@/lib/bookings/format";
import {
  useLegacyPackageBalanceQuery,
  useRecordLegacyPackageBalanceMutation,
} from "@/lib/packages/hooks";

const SETTLEMENT_LABELS: Record<LegacyPackageBalance["settlementStatus"], string> = {
  NOT_REQUIRED: "No balance required",
  NOT_RECORDED: "Not yet recorded",
  NOT_PAID: "Not paid",
  PARTIALLY_PAID: "Partially paid",
  PAID_IN_FULL: "Paid in full",
};

const BLOCKED_TEXT: Record<NonNullable<LegacyPackageBalance["blockedReason"]>, string> = {
  SETTLED: "The package balance is paid in full. The customer can schedule their remaining sessions.",
  PACKAGE_VOIDED: "This package was cancelled. No balance can be recorded against it.",
  ORIGIN_NOT_FINAL:
    "The purchase appointment is still open. Record the venue payment when you complete it.",
  UPFRONT_REVERSED:
    "The online payment for this purchase was refunded or disputed, so the outstanding balance can't be recorded here. Contact Bookly support before taking payment.",
};

/** Exact decimal parsing: never round fractional cents into a different payment. */
const parseAmountCents = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return undefined;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined;
};

const newKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `bal-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Fix #3 — Business Owner records a real venue payment against a Legacy Package purchase balance,
 * independently of the purchase appointment's status. Every amount shown comes from the server;
 * the server re-checks the outstanding balance before recording anything.
 */
export default function LegacyPackageBalancePanel({
  businessId,
  packageId,
}: {
  businessId: string;
  packageId: string;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const isOwner = role === "BUSINESS_OWNER";
  const query = useLegacyPackageBalanceQuery(businessId, packageId, { enabled: isOwner });
  const mutation = useRecordLegacyPackageBalanceMutation(businessId, packageId);
  const [mode, setMode] = useState<"FULL" | "PARTIAL">("FULL");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string>();
  const keyRef = useRef(newKey());
  const submitting = useRef(false);

  // Any change to what would be recorded is a new payment request with a new key. A retry of the
  // SAME request after a lost response keeps its key so the server replays instead of re-recording.
  useEffect(() => {
    keyRef.current = newKey();
  }, [mode, amount, note]);

  if (!isOwner) return null;
  if (query.isError)
    return (
      <div role="alert" className="rounded-xl border border-[#DDD2F7] bg-white p-4 font-poppins text-sm text-[#1C1B1C]">
        Package balance could not be loaded.{" "}
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="underline disabled:opacity-50">
          {query.isFetching ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  if (!query.data)
    return (
      <p role="status" className="rounded-xl border border-[#DDD2F7] bg-white p-4 font-poppins text-sm text-[#675A82]">
        Loading package balance...
      </p>
    );

  const balance = query.data;
  const partialCents = mode === "PARTIAL" ? parseAmountCents(amount) : undefined;
  const recordCents = mode === "FULL" ? balance.outstandingCents : partialCents;

  const review = () => {
    setFormError(undefined);
    if (mode === "PARTIAL") {
      if (partialCents === undefined) {
        setFormError("Enter an amount greater than 0 with at most two decimal places.");
        return;
      }
      if (partialCents >= balance.outstandingCents) {
        setFormError(
          `A partial payment must be less than the ${formatBookingMoney(balance.outstandingCents)} outstanding. Choose "Full outstanding balance" instead.`,
        );
        return;
      }
    }
    mutation.reset();
    setConfirming(true);
  };

  const submit = () => {
    if (submitting.current || recordCents === undefined) return;
    submitting.current = true;
    const trimmedNote = note.trim() || undefined;
    const common = {
      expectedOutstandingCents: balance.outstandingCents,
      idempotencyKey: keyRef.current,
      ...(trimmedNote ? { note: trimmedNote } : {}),
    };
    mutation.mutate(
      mode === "FULL"
        ? { settlement: "FULL", ...common }
        : { settlement: "PARTIAL", amountCents: recordCents, ...common },
      {
        onSuccess: () => {
          setConfirming(false);
          setAmount("");
          setNote("");
          setMode("FULL");
          keyRef.current = newKey();
        },
        onError: (error) => {
          // A definitive refusal ends this request; a network failure keeps its key for a retry.
          if (error instanceof BooklyApiError && error.status !== undefined && error.status >= 400 && error.status < 500) {
            keyRef.current = newKey();
            setConfirming(false);
            if (error.code === "PACKAGE_BALANCE_CHANGED") void query.refetch();
          }
        },
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };

  return (
    <section aria-label="Package balance" className="flex flex-col gap-4 rounded-xl border border-[#DDD2F7] bg-white p-4 font-poppins">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1C1B1C]">Package purchase balance</p>
        <span className="rounded-full bg-[#F7F4FF] px-3 py-1 text-[11px] font-semibold text-[#675A82]">
          {SETTLEMENT_LABELS[balance.settlementStatus]}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[#675A82]">Balance due at venue</dt>
          <dd className="font-semibold text-[#1C1B1C]">{formatBookingMoney(balance.originalBalanceCents)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[#675A82]">Recorded as paid</dt>
          <dd className="font-semibold text-[#1C1B1C]">{formatBookingMoney(balance.paidCents)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-[#675A82]">Outstanding</dt>
          <dd className="font-semibold text-[#1C1B1C]">{formatBookingMoney(balance.outstandingCents)}</dd>
        </div>
      </dl>
      {balance.payments.length > 0 && (
        <ul aria-label="Recorded venue payments" className="flex flex-col gap-1 text-xs text-[#5F5E5A]">
          {balance.payments.map((payment, index) => (
            <li key={`${payment.recordedAt}-${index}`}>
              {formatBookingMoney(payment.amountCents)} recorded{" "}
              {formatBookingDate(payment.recordedAt, "Europe/Nicosia")}
              {payment.source === "COMPLETION" ? " at completion" : ""}
            </li>
          ))}
        </ul>
      )}
      {balance.blockedReason ? (
        <p role="status" className="text-sm text-[#675A82]">{BLOCKED_TEXT[balance.blockedReason]}</p>
      ) : balance.recordable ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-[#5F5E5A]">
            The customer&apos;s remaining sessions unlock only once the full balance is recorded. Record only money you
            actually received. The purchase appointment&apos;s status does not change.
          </p>
          <fieldset className="flex flex-col gap-2" disabled={mutation.isPending}>
            <legend className="sr-only">Payment received</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name={`balance-mode-${packageId}`} checked={mode === "FULL"} onChange={() => { setMode("FULL"); setConfirming(false); }} />
              Full outstanding balance ({formatBookingMoney(balance.outstandingCents)})
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name={`balance-mode-${packageId}`} checked={mode === "PARTIAL"} onChange={() => { setMode("PARTIAL"); setConfirming(false); }} />
              Part of the balance
            </label>
            {mode === "PARTIAL" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#675A82]">Amount received (EUR)</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => { setAmount(event.target.value); setConfirming(false); setFormError(undefined); }}
                  className="w-full max-w-[200px] rounded-lg border border-neutral-300 px-3 py-2"
                  aria-label="Amount received"
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[#675A82]">Internal note (optional)</span>
              <input
                value={note}
                maxLength={500}
                onChange={(event) => { setNote(event.target.value); setConfirming(false); }}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                aria-label="Internal note"
              />
            </label>
          </fieldset>
          {formError && <p role="alert" className="text-xs text-red-600">{formError}</p>}
          {mutation.isError && <p role="alert" className="text-xs text-red-600">{toUserMessage(mutation.error)}</p>}
          {confirming && recordCents !== undefined ? (
            <div role="dialog" aria-label="Confirm venue payment" className="flex flex-col gap-2 rounded-lg bg-[#F7F4FF] p-3">
              <p>
                Record {formatBookingMoney(recordCents)} received at the venue? This is added to the payment history and
                cannot be undone here.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={submit} disabled={mutation.isPending} className="rounded-lg bg-[#1C1B1C] px-4 py-2 font-semibold text-white disabled:opacity-50">
                  {mutation.isPending ? "Recording..." : "Confirm payment"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={mutation.isPending} className="rounded-lg border px-4 py-2 disabled:opacity-50">
                  Back
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={review} disabled={mutation.isPending} className="w-full rounded-lg border border-[#675A82] px-4 py-2 font-semibold text-[#675A82] disabled:opacity-50 sm:w-auto">
              Record venue payment
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
