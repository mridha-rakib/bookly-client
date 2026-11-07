"use client";
import { invalidateBusinessBookingViews } from "@/lib/bookings/dashboard-cache";
import ReturningCustomerBadge from "@/components/payments/ReturningCustomerBadge";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { packagePurchaseApi, type PackagePurchaseResult } from "@/lib/api/package-purchase";
import type { RetainedPurchaseQuote } from "@/lib/api/package-consent";
import { packageLifecycleError } from "@/lib/api/package-lifecycle";
import { getStripe } from "@/lib/payments/stripe-client";
import { formatBookingMoney } from "@/lib/bookings/format";
import { bookingKeys } from "@/lib/bookings/hooks";
import { FirstClassBookingConfirmation } from "./FirstClassBookingConfirmation";
import { PackageSavedCard } from "./PackageSavedCard";
import { packagePrimaryCta, packageSecondaryCta } from "./package-cta";

/** Exact original operation only. No payment secret/result is persisted in the browser. */
export function PackagePurchaseContinuation({ businessId, operationId, quote, accepted, available, recoverOnMount = false, onVerified, showSavedCard = true, paymentMethodReady = true }: {
  businessId: string; operationId: string; quote?: RetainedPurchaseQuote; accepted: boolean; available: boolean;
  recoverOnMount?: boolean;
  /** False when the host wizard already shows the shared Payment card management. */
  showSavedCard?: boolean;
  /** Host-reported saved-card readiness. It only gates starting a new paid purchase. */
  paymentMethodReady?: boolean;
  onVerified?: (result: PackagePurchaseResult) => void;
}) {
  const cache = useQueryClient(), inFlight = useRef(false);
  const recovered = useRef(false);
  const [now, setNow] = useState<number>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<PackagePurchaseResult>();
  const [sent, setSent] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize the display-only wall clock after hydration.
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, []);
  const expired = !quote || now === undefined || now >= Date.parse(quote.expiresAt);
  const enabled = available && quote?.certification === "CERTIFIED" && accepted;
  async function run(work: () => Promise<PackagePurchaseResult>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await work();
      if (response.operationId !== operationId || response.canStartNewQuote !== false || (quote &&
        (response.quoteId !== quote.quoteId || response.termsHash !== quote.termsHash ||
          Date.parse(response.issuedAt) !== Date.parse(quote.issuedAt) ||
          Date.parse(response.expiresAt) !== Date.parse(quote.expiresAt))))
        throw Error("Purchase response identity mismatch");
      if (response.state === "COMPLETE" && (response.purchaseCompletion !== "VERIFIED" ||
        !response.packageProgressId || !response.bookingIds?.length ||
        (response.primaryBookingId !== undefined && !response.bookingIds.includes(response.primaryBookingId))))
        throw Error("Purchase completion is missing canonical package or appointment references");
      setResult(response);
      if (response.state === "COMPLETE" && response.purchaseCompletion === "VERIFIED") {
        onVerified?.(response);
        // Cache readback is independent of canonical success. A hanging/failed refetch must
        // never trap a verified purchase on checkout or turn it into a purchase error.
        void Promise.allSettled([
          invalidateBusinessBookingViews(cache, businessId),
          cache.invalidateQueries({ queryKey: ["packageViews"] }),
          cache.invalidateQueries({ queryKey: bookingKeys.customerAll }),
          cache.invalidateQueries({ queryKey: bookingKeys.lists(businessId) }),
          cache.invalidateQueries({ queryKey: bookingKeys.calendars(businessId) }),
          cache.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability }),
        ]);
      }
    } catch (e) { setError(packageLifecycleError(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!recoverOnMount || recovered.current) return;
    recovered.current = true;
    // One read-only observation of the original operation; never complete(), renew or pay.
    void run(() => packagePurchaseApi.status(businessId, operationId));
    // This form is scoped/remounted by the parent for a different account or operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoverOnMount, businessId, operationId]);
  const complete = () => run(() => { setSent(true); return packagePurchaseApi.complete(businessId, operationId); });
  const verified = result?.state === "COMPLETE" && result.purchaseCompletion === "VERIFIED" && Boolean(result.packageProgressId);
  if (verified) return <FirstClassBookingConfirmation businessId={businessId} progressId={result!.packageProgressId!} bookingIds={result!.bookingIds!} primaryBookingId={result!.primaryBookingId} kind="PURCHASE" classification={quote?.financials.classification} />;
  const started = sent || result?.state === "PAYMENT_PENDING" || result?.state === "UNRESOLVED";
  const awaitingCard = !started && !paymentMethodReady && (quote?.financials?.requiredUpfrontCents ?? 0) > 0;
  // P4K-5 correction: after the quote deadline F2 resumes ONLY a batch already persisting (or
  // materialized); a PREPARED batch, including one whose payment awaits 3DS or has not begun
  // persistence, is refused at or after expiresAt. So after expiry only those server-reported
  // states may retry, and payment authentication is never offered. The quote is never renewed.
  const resumableAfterDeadline = result?.state === "UNRESOLVED" ||
    (result?.state === "PAYMENT_PENDING" && result.persistenceStatus === "PERSISTING");
  const closedAfterDeadline = expired && result?.state === "PAYMENT_PENDING" && !resumableAfterDeadline;
  const quoteTime = (instant: string) => quote ? `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: quote.timezone }).format(new Date(instant))} (${quote.timezone})` : "";
  const remainingSeconds = quote && now !== undefined ? Math.max(0, Math.floor((Date.parse(quote.expiresAt) - now) / 1000)) : 0;
  const remainingLabel = remainingSeconds >= 60 ? `${Math.floor(remainingSeconds / 60)} min ${remainingSeconds % 60} s` : `${remainingSeconds} seconds`;
  const classification = quote?.financials.classification === "FIRST" ? "First-time customer (FIRST)" : "Returning customer (RETURNING)";
  const notice = "rounded-lg p-3 text-sm leading-6";
  return <section className="min-w-0 w-full lg:w-[714px] space-y-4 rounded-xl border border-[#ECEBEF] bg-white p-5 shadow-sm text-[#1C1B1C]" aria-label="Package purchase continuation" aria-busy={busy}>
    {quote && <><h2 className="text-[#1E293B] font-semibold text-xl font-inter">Original purchase quote</h2>
      <ReturningCustomerBadge returning={quote.financials.classification === "RETURNING" && !expired && now !== undefined} upfrontCents={quote.financials.requiredUpfrontCents} />
      <p className="text-sm leading-6 text-[#45474B]">Issued {quoteTime(quote.issuedAt)} · Deadline {quoteTime(quote.expiresAt)} · No renewal on retry.</p>
      <p className={`${notice} font-medium ${expired && now !== undefined ? "bg-red-50 text-red-800" : remainingSeconds < 300 ? "bg-[#FEF8CF] text-[#322509]" : "bg-[#F5F4EE] text-[#1C1B1C]"}`} aria-live="off">
        {now === undefined ? "Checking the quoted deadline…" : expired ? "Quote window expired. Existing payment or commit outcomes still require status/recovery." : `About ${remainingLabel} remain (display estimate).`}
      </p>
      <dl className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5] text-sm">
        {([["Package bundle", quote.financials.bundlePriceCents], ["Add-ons", quote.financials.addonsCents], ["Travel fee", quote.financials.travelCents]] as const).map(([label, cents]) =>
          <div key={label} className="flex justify-between gap-4 px-3 py-2.5"><dt>{label}</dt><dd className="font-medium">{formatBookingMoney(cents)}</dd></div>)}
        <div className="flex justify-between gap-4 px-3 py-2.5 font-semibold"><dt>Total</dt><dd>{formatBookingMoney(quote.financials.normalTotalCents)}</dd></div>
        <div className="flex justify-between gap-4 px-3 py-2.5 text-base font-semibold bg-[#F5F4EE]"><dt>Payable online now</dt><dd>{formatBookingMoney(quote.financials.requiredUpfrontCents)}</dd></div>
        <div className="flex justify-between gap-4 px-3 py-2.5"><dt>Venue dues (paid at the appointment)</dt><dd className="font-medium">{formatBookingMoney(quote.financials.manualVenueDuesCents)}</dd></div>
      </dl>
      <p className="text-sm text-[#45474B]"><span className="font-semibold text-[#1C1B1C]">{classification}</span> · Total {formatBookingMoney(quote.financials.normalTotalCents)}. Quoted payable online now {formatBookingMoney(quote.financials.requiredUpfrontCents)} · Venue dues {formatBookingMoney(quote.financials.manualVenueDuesCents)}. Admission must confirm the quoted relationship and amount.</p></>}
    {!enabled && <p role="status" className={`${notice} bg-[#F5F4EE] text-[#45474B]`}>Purchase unavailable: the server has not confirmed certified consent and checkout readiness. Recorded acceptance alone does not purchase a Package.</p>}
    {showSavedCard && enabled && !verified && quote && quote.financials.requiredUpfrontCents > 0 && <PackageSavedCard />}
    {enabled && awaitingCard && <p role="status" className={`${notice} bg-[#FEF8CF] text-[#322509]`}>Add or confirm your saved card above before purchasing.</p>}
    {!verified && <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button className={`${packagePrimaryCta} w-full sm:w-auto`} type="button" disabled={!enabled || busy || awaitingCard || (expired && !resumableAfterDeadline) || result?.state === "COMPENSATION"} onClick={() => void complete()}>{busy ? "Checking…" : started ? "Retry original purchase" : "Purchase this Package"}</button>
      <button className={`${packageSecondaryCta} w-full sm:w-auto`} type="button" disabled={busy} onClick={() => void run(() => packagePurchaseApi.status(businessId, operationId))}>Check original purchase status</button></div>}
    {result && <p role="status" className={`${notice} bg-[#FEF8CF] text-[#322509]`}>Purchase unconfirmed: {result.state}. Payment {result.providerStatus ?? "not confirmed"}; persistence {result.persistenceStatus ?? "not confirmed"}; compensation {result.compensationStatus ?? "not confirmed"}. No usable credits are confirmed.</p>}
    {result?.compensationStatus && result.compensationStatus !== "NOT_REQUIRED" && <p className={`${notice} bg-[#F5F4EE]`}>{result.compensationStatus === "REFUNDED" ? "The recorded refund is confirmed." : "Refund or compensation is pending; reimbursement is not confirmed."}</p>}
    {closedAfterDeadline && <p role="alert" className={`${notice} bg-red-50 text-red-800`}>The quote deadline passed before this purchase could be completed. Do not authenticate this payment: the purchase cannot complete now. No usable credits are confirmed; any payment outcome follows server recovery.</p>}
    {enabled && !expired && result?.clientSecret && result.providerStatus === "REQUIRES_ACTION" && <button className={`${packagePrimaryCta} w-full sm:w-auto`} type="button" disabled={busy} onClick={() => void run(async () => {
      const stripe = await getStripe(); if (!stripe) throw Error("Secure payment unavailable");
      const confirmation = await stripe.confirmCardPayment(result.clientSecret!); if (confirmation.error) throw confirmation.error;
      // 3DS success is not purchase success; F2 must prove complete atomic persistence.
      return packagePurchaseApi.complete(businessId, operationId);
    })}>Continue secure payment authentication</button>}
    {result?.providerStatus === "FAILED" && <p role="alert" className={`${notice} bg-red-50 text-red-800`}>Payment failed or needs another payment method. Resolve the original attempt; no new payment operation has been created.</p>}
    {error && <p role="alert" className={`${notice} bg-red-50 text-red-800`}>{error}</p>}
    <p className="text-sm text-[#45474B] break-words">A quote does not hold capacity. The server admits all initial appointments after payment succeeds. Retain operation {operationId} while any outcome is uncertain.</p>
  </section>;
}
