"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { packagePurchaseApi, type PackagePurchaseResult } from "@/lib/api/package-purchase";
import type { RetainedPurchaseQuote } from "@/lib/api/package-consent";
import { packageLifecycleError } from "@/lib/api/package-lifecycle";
import { getStripe } from "@/lib/payments/stripe-client";
import { formatBookingMoney } from "@/lib/bookings/format";

/** Exact original operation only. No payment secret/result is persisted in the browser. */
export function PackagePurchaseContinuation({ businessId, operationId, quote, accepted, available }: {
  businessId: string; operationId: string; quote?: RetainedPurchaseQuote; accepted: boolean; available: boolean;
}) {
  const cache = useQueryClient(), inFlight = useRef(false);
  const [now, setNow] = useState<number>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<PackagePurchaseResult>();
  const [sent, setSent] = useState(false);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = !quote || now === undefined || now >= Date.parse(quote.expiresAt);
  const enabled = available && quote?.certification === "CERTIFIED" && accepted;
  async function run(work: () => Promise<PackagePurchaseResult>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await work();
      if (response.operationId !== operationId || (quote && (response.quoteId !== quote.quoteId || response.termsHash !== quote.termsHash)))
        throw Error("Purchase response identity mismatch");
      setResult(response);
      if (response.state === "COMPLETE" && response.purchaseCompletion === "VERIFIED") {
        await cache.invalidateQueries({ queryKey: ["packageViews"] }); await cache.invalidateQueries({ queryKey: ["customerBookings"] });
      }
    } catch (e) { setError(packageLifecycleError(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const complete = () => run(() => { setSent(true); return packagePurchaseApi.complete(businessId, operationId); });
  const verified = result?.state === "COMPLETE" && result.purchaseCompletion === "VERIFIED" && Boolean(result.packageProgressId);
  const started = sent || result?.state === "PAYMENT_PENDING" || result?.state === "UNRESOLVED";
  // P4K-5 correction: after the quote deadline F2 resumes ONLY a batch already persisting (or
  // materialized); a PREPARED batch, including one whose payment awaits 3DS or has not begun
  // persistence, is refused at or after expiresAt. So after expiry only those server-reported
  // states may retry, and payment authentication is never offered. The quote is never renewed.
  const resumableAfterDeadline = result?.state === "UNRESOLVED" ||
    (result?.state === "PAYMENT_PENDING" && result.persistenceStatus === "PERSISTING");
  const closedAfterDeadline = expired && result?.state === "PAYMENT_PENDING" && !resumableAfterDeadline;
  return <section className="space-y-3 rounded-xl border p-4" aria-label="Package purchase continuation">
    {quote && <><h2 className="font-semibold">Original purchase quote</h2>
      <p>Issued {new Date(quote.issuedAt).toISOString()} · Deadline {new Date(quote.expiresAt).toISOString()} · No renewal on retry.</p>
      <p>{expired ? "Quote window expired. Existing payment or commit outcomes still require status/recovery." : `About ${Math.max(0, Math.floor((Date.parse(quote.expiresAt) - (now ?? 0)) / 1000))} seconds remain (display estimate).`}</p>
      <p>Bundle {formatBookingMoney(quote.financials.bundlePriceCents)} · Add-ons {formatBookingMoney(quote.financials.addonsCents)} · Travel {formatBookingMoney(quote.financials.travelCents)}</p>
      <p>Quoted payable online now {formatBookingMoney(quote.financials.requiredUpfrontCents)} · Venue dues {formatBookingMoney(quote.financials.manualVenueDuesCents)}. Admission must confirm the quoted relationship and amount.</p></>}
    {!enabled && <p role="status">Purchase unavailable: durable consent certification and production activation remain pending. Recorded acceptance alone does not purchase a Package.</p>}
    {!verified && <><button type="button" disabled={!enabled || busy || (expired && !resumableAfterDeadline) || result?.state === "COMPENSATION"} onClick={() => void complete()}>{busy ? "Checking…" : started ? "Retry original purchase" : "Purchase this Package"}</button>
      <button type="button" disabled={busy || !available} onClick={() => void run(() => packagePurchaseApi.status(businessId, operationId))}>Check original purchase status</button></>}
    {verified ? <p role="status">Package purchase verified by the server. <Link className="underline" href={`/customer/packages/${result!.packageProgressId}?kind=first-class`}>View verified Package</Link></p>
      : result && <p role="status">Purchase unconfirmed: {result.state}. Payment {result.providerStatus ?? "not confirmed"}; persistence {result.persistenceStatus ?? "not confirmed"}; compensation {result.compensationStatus ?? "not confirmed"}. No usable credits are confirmed.</p>}
    {result?.compensationStatus && result.compensationStatus !== "NOT_REQUIRED" && <p>{result.compensationStatus === "REFUNDED" ? "The recorded refund is confirmed." : "Refund or compensation is pending; reimbursement is not confirmed."}</p>}
    {closedAfterDeadline && <p role="alert">The quote deadline passed before this purchase could be completed. Do not authenticate this payment: the purchase cannot complete now. No usable credits are confirmed; any payment outcome follows server recovery.</p>}
    {enabled && !expired && result?.clientSecret && result.providerStatus === "REQUIRES_ACTION" && <button type="button" disabled={busy} onClick={() => void run(async () => {
      const stripe = await getStripe(); if (!stripe) throw Error("Secure payment unavailable");
      const confirmation = await stripe.confirmCardPayment(result.clientSecret!); if (confirmation.error) throw confirmation.error;
      // 3DS success is not purchase success; F2 must prove complete atomic persistence.
      return packagePurchaseApi.complete(businessId, operationId);
    })}>Continue secure payment authentication</button>}
    {result?.providerStatus === "FAILED" && <p role="alert">Payment failed or needs another payment method. Resolve the original attempt; no new payment operation has been created.</p>}
    {error && <p role="alert">{error}</p>}
    <p className="text-sm">A quote does not hold capacity. The server admits all initial appointments after payment succeeds. Retain operation {operationId} while any outcome is uncertain.</p>
  </section>;
}
