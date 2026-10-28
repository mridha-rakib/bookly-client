"use client";
import Link from "next/link";
import { useState } from "react";
import type { OwnedPackageView, PackageOffer, PackageSettlementView } from "@/lib/api/package-views";
import { BooklyApiError } from "@/lib/api/client";
import { formatBookingMoney } from "@/lib/bookings/format";
import { packagePrimaryCta, packageSecondaryCta } from "./package-cta";

const card = "min-w-0 rounded-xl border border-[#C6C6CB] bg-white p-5 sm:p-7 font-poppins text-[#020305] break-words";
const button = packagePrimaryCta;
export const PACKAGE_UNAVAILABLE = "First-class Package checkout and session changes are unavailable while genuine purchase consent is being completed. No purchase, charge or booking will be made.";
export function PackageUnavailable() {
  return <p role="status" className="rounded-xl bg-[#F5F4EE] p-4 text-sm leading-6">{PACKAGE_UNAVAILABLE}</p>;
}
export function PackageReadError({ error }: { error: unknown }) {
  const status = error instanceof BooklyApiError ? error.status : undefined;
  const message = status === 401 ? "Sign in again to view your packages." : status === 403 ? "Your account cannot access this package information."
    : status === 404 ? "Package unavailable or not owned by your account." : status === 409 ? "Package information has changed. Refresh before continuing."
    : status === 429 ? "Too many requests. Wait before refreshing." : status === 503 ? "Package information is temporarily unavailable. Try again later."
    : "Package information could not be loaded. Try again later.";
  return <p role="alert" className={`${card} text-[#BA1A1A]`}>{message}</p>;
}
export function OfferCard({ offer, detail = false }: { offer: PackageOffer; detail?: boolean }) {
  return <article className={`${card} flex flex-col gap-5`}>
    {detail ? <h1 className="font-manrope text-2xl font-bold">{offer.name}</h1> : <h3 className="font-manrope text-xl font-bold">{offer.name}</h3>}
    {offer.description && <p className="text-sm leading-6 text-[#5F5E5A]">{offer.description}</p>}
    <ul className="space-y-3">{offer.items.map((item) => <li key={item.itemId} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#F5F4EE] p-3">
      <span>{item.name}<span className="block text-xs text-[#5F5E5A]">{item.pricingMode === "PER_PERSON" ? "Group · One credit = one participant / seat" : "Fixed session"}</span></span>
      <span className="font-semibold">{item.quantity} sessions</span>
    </li>)}</ul>
    <p>{offer.items.reduce((n, item) => n + item.quantity, 0)} total sessions · {formatBookingMoney(offer.bundlePriceCents)}</p>
    <p className="text-sm">{offer.validity.mode === "FOREVER" ? "FOREVER · No expiry" : `FINITE${offer.validity.months} · ${offer.validity.months} calendar months from purchase`}</p>
    <p className="text-sm text-[#5F5E5A]">{offer.fulfilmentMode === "TRAVEL_TO_CUSTOMER" ? "Travel appointments. Purchased travel rights require exact server terms; current settings are not purchased rights." : "Appointments at the business location."}</p>
    {detail ? <><PackageUnavailable /><button type="button" className={button} disabled>Checkout unavailable</button>
      <InitialAppointmentReview />
      <p className="text-sm">A package purchase requires at least one real initial appointment. Remaining credits do not create placeholder bookings. Final FIRST / RETURNING classification, upfront amount and penalty disclosures require an authoritative server quote.</p></>
      : <Link className="font-semibold text-[#240183] underline" href={`/customer/package-consent/${offer.businessId}/${offer.id}`}>View package details</Link>}
  </article>;
}
function Counter({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#F5F4EE] p-3"><dt className="text-xs text-[#5F5E5A]">{label}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>;
}
export function OwnedPackageCard({ pkg, detail = false, sessionReview = true }: { pkg: OwnedPackageView; detail?: boolean; sessionReview?: boolean }) {
  // P2A: credits are usable only when the server verified the original purchase completed.
  const purchaseVerified = pkg.purchaseCompletion === "VERIFIED";
  return <article className={`${card} flex flex-col gap-5`}>
    {detail ? <h1 className="font-manrope text-2xl font-bold">{pkg.name}</h1> : <h3 className="font-manrope text-xl font-bold">{pkg.name}</h3>}
    <p className="text-sm">First-class Package · {pkg.status}</p>
    {!purchaseVerified && <p role="status" className="rounded-xl bg-[#F5F4EE] p-3 text-sm">Purchase not completed. These sessions cannot be booked or used, and no payment is confirmed.</p>}
    <p className="text-sm">{pkg.validity?.mode === "FOREVER" ? "FOREVER · No expiry" : pkg.validity?.expiresAt ? `Expires ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: pkg.validity.timezone ?? "UTC" }).format(new Date(pkg.validity.expiresAt))} (${pkg.validity.timezone})` : "Validity unavailable"}</p>
    {pkg.items.map((item) => <section key={item.id} aria-label={item.name}>
      <h4 className="mb-3 font-semibold">{item.name}</h4>
      {item.group && <p className="mb-3 text-sm">Group · One credit = one participant / seat</p>}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{(["total", "remaining", "scheduled", "completed", "forfeited", "expired"] as const).map((key) => <Counter key={key} label={key[0].toUpperCase() + key.slice(1)} value={item[key]} />)}</dl>
      {detail && item.travelCities.length > 0 && <p className="mt-3 text-sm">Purchased travel rights: {item.travelCities.map((city) => `${city.city} (${formatBookingMoney(city.feeCents)})`).join(", ")}. Current coverage must still permit the appointment.</p>}
    </section>)}
    {pkg.purchaseFinancials ? <section aria-label="Original package purchase"><h4 className="font-semibold">Original package purchase</h4>
      <p className="text-sm leading-7">Bundle {formatBookingMoney(pkg.bundlePriceCents)} · Deposit paid {formatBookingMoney(pkg.purchaseFinancials.depositCents)} · Outstanding {formatBookingMoney(pkg.purchaseFinancials.outstandingBalanceCents)}</p>
      {!pkg.purchaseFinancials.balanceSettled && <p className="text-sm text-[#BA1A1A]">Remaining sessions are locked until the original balance is settled.</p>}</section>
      : <p>Original purchase financial status unavailable. No payment confirmation inferred.</p>}
    {detail ? <>{!pkg.actionsAvailable && <PackageUnavailable />}
      {pkg.penalty && <p className="text-sm">Independent penalties: appointment cap {formatBookingMoney(pkg.penalty.appointmentCapCents)}, lifetime cap {formatBookingMoney(pkg.penalty.lifetimeCapCents)}. Original upfront does not pay later penalties. Remaining penalty allowance requires a server assessment.</p>}
      <h2 className="text-lg font-bold">Session history</h2>
      <OperationHistory view={pkg} />
      {pkg.sessions.length === 0 && <p>No associated bookings.</p>}
      {pkg.sessions.map((session) => <section key={session.bookingId} className="rounded-xl border border-[#C6C6CB] p-4 text-sm leading-7">
        <p className="font-semibold">{session.status} · {session.booking?.role === "PURCHASE" ? "Original initial appointment" : session.booking?.role === "REDEMPTION" ? "Later redeemed appointment" : "Booking association unavailable"}</p>
        {session.restoration && <p>Restored credit: {session.restoration}</p>}
        {session.booking ? <><p>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: session.booking.timezone }).format(new Date(session.booking.startAt))} ({session.booking.timezone})</p>
          <p>Booking status: {session.booking.status} · Occupied duration: {session.booking.occupiedDurationMin ?? "Unavailable"} min</p>
          <p>Professional: {session.booking.staffName ?? "Name unavailable"}</p>
          <p>Session Travel {formatBookingMoney(session.booking.travelFeeCents)} · Add-ons {formatBookingMoney(session.booking.addonsSubtotalCents)} · Session outstanding {formatBookingMoney(session.booking.outstandingBalanceCents)}</p>
          <Link className="text-[#240183] underline" href={`/customer/bookings/view?id=${session.bookingId}`}>View booking</Link></> : <p>Booking details unavailable. No booking success is inferred.</p>}
      </section>)}
      {purchaseVerified && sessionReview && !pkg.actionsAvailable && <SessionReview remainingItems={pkg.items.filter((i) => i.remaining > 0).map((i) => ({ id: i.id, name: i.name }))} />}
    </> : <Link className="text-[#240183] underline" href={`/customer/packages/${pkg.id}?kind=first-class`}>View sessions and balances</Link>}
  </article>;
}
export interface SessionReviewTerms {
  disclosure: string; travelCents: number; addonsCents: number; totalCents: number;
  paymentState: string; providers: Array<{ id: string; name: string }>;
  slots: Array<{ id: string; label: string }>; quoteState: "CURRENT" | "STALE";
}
/** Presentation only: no local quote calculation, authority assertion or mutation transport. */
export function SessionReview({ remainingItems, terms }: {
  remainingItems: Array<{ id: string; name: string }>; terms?: SessionReviewTerms;
}) {
  const [checked, setChecked] = useState(false);
  return <section className={`${card} space-y-4`} aria-label="Remaining session booking">
    <h2 className="font-manrope text-xl font-bold">Book a remaining session</h2>
    <label className="block text-sm">Purchased service<select aria-label="Purchased service" className="mt-2 w-full rounded-xl border p-3" disabled={!terms || !remainingItems.length}><option value="">Select a service</option>{remainingItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
    <label className="block text-sm">Professional<select aria-label="Professional" className="mt-2 w-full rounded-xl border p-3" disabled={!terms}><option value="">{terms ? "Select a professional" : "Professionals unavailable"}</option>{terms?.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label className="block text-sm">Appointment time<select aria-label="Appointment time" className="mt-2 w-full rounded-xl border p-3" disabled={!terms}><option value="">{terms ? "Select a time" : "Times unavailable"}</option>{terms?.slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    <p className="text-sm">Purchased session base: {formatBookingMoney(0)}. The package bundle is not charged again. One redeemed session uses one remaining credit.</p>
    {terms ? <><p role="status">{terms.quoteState === "STALE" ? "Quote stale — request new server terms" : "Session terms supplied by server"}</p>
      <p className="text-sm">Travel {formatBookingMoney(terms.travelCents)} · Add-ons {formatBookingMoney(terms.addonsCents)} · Independent total {formatBookingMoney(terms.totalCents)}</p>
      <pre aria-label="Exact session disclosure" className="whitespace-pre-wrap break-words font-poppins text-sm leading-6">{terms.disclosure}</pre>
      <PaymentStatus state={terms.paymentState} />
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={terms.quoteState !== "CURRENT"} />Review independent session dues (review only; acceptance unavailable)</label></>
      : <p className="text-sm">An authoritative session quote, permitted location, professionals, times and separate Travel/Add-on terms are unavailable.</p>}
    <button type="button" disabled className={button}>Session booking unavailable</button>
  </section>;
}
export function PaymentStatus({ state }: { state: string }) {
  const states: Record<string, string> = { NONE: "No charge", VENUE_DUE: "Venue dues outstanding", REQUIRES_ACTION: "Payment action required", CREATED: "Online payment pending", NOT_CREATED: "Payment not initiated", PROCESSING: "Payment processing", SUCCEEDED: "Payment succeeded", FAILED: "Payment failed", CANCELED: "Payment canceled", REQUIRED: "Compensation pending", REFUND_PENDING: "Refund pending", REFUNDED: "Refunded", PENDING: "No-show assessment pending", NO_SHOW_CHARGED: "No-show penalty charged", NO_SHOW_WAIVED: "No-show monetary penalty waived" };
  return <p role="status" className="rounded-xl bg-[#F5F4EE] p-3 text-sm">{states[state] ?? "Unknown — recovery pending. Payment and booking success are unconfirmed."}</p>;
}

export function InitialAppointmentReview({ appointments = [], remainingCredits, disclosure, quoteState }: {
  appointments?: Array<{ id: string; service: string; professional: string; time: string; group: boolean }>;
  remainingCredits?: number; disclosure?: string; quoteState?: string;
}) {
  return <section className="space-y-3" aria-label="Initial appointment review"><h2 className="text-lg font-bold">Initial appointments</h2>
    {!appointments.length ? <p className="text-sm">At least one real initial appointment is required. Service, professional and available times require server selection data.</p>
      : <ul className="space-y-2">{appointments.map((a) => <li key={a.id} className="rounded-xl border p-3 text-sm">{a.service} · {a.professional} · {a.time}{a.group && <span className="block">Group: one credit / one seat</span>}</li>)}</ul>}
    {remainingCredits !== undefined && <p>Unscheduled credits: {remainingCredits}. No placeholder bookings.</p>}
    {quoteState && <p role="status">Quote: {quoteState}</p>}
    {disclosure && <pre className="whitespace-pre-wrap break-words font-poppins text-sm">{disclosure}</pre>}
    <p role="status" className="text-sm text-[#5F5E5A]">Consent and purchase unavailable. No acceptance or purchase can be submitted.</p></section>;
}
export function CancellationReview({ terms }: { terms?: { classification: string; creditEffect: string; penaltyCents: number; paymentState: string } }) {
  return <section className={`${card} space-y-3`} aria-label="Package cancellation review"><h2 className="text-lg font-bold">Package cancellation</h2>
    {terms ? <><p>{terms.classification} · Credit: {terms.creditEffect}</p><p>Independent monetary penalty {formatBookingMoney(terms.penaltyCents)}</p><PaymentStatus state={terms.paymentState} /></> : <p className="text-sm">Exact free / late classification, credit restoration, expiry or forfeiture and any independent penalty require server terms. Original package upfront is not automatically refunded.</p>}
    <button type="button" className={packageSecondaryCta} disabled>Cancellation unavailable</button></section>;
}
export function SettlementCard({ view }: { view: PackageSettlementView }) {
  return <section className={`${card} space-y-4`} aria-label="Package venue settlement"><h2 className="text-xl font-bold">Package venue settlement</h2>
    <p className="text-sm">Permanent purchase origin: {view.originBookingId}</p>
    {view.session?.booking && <p className="text-sm">{view.session.booking.role === "REDEMPTION" ? "Later redeemed appointment — independent session dues" : view.session.booking.role === "PURCHASE" ? "Original initial appointment" : "Appointment association unavailable"}</p>}
    {view.purchaseFinancials ? <p className="text-sm leading-7">Original total {formatBookingMoney(view.purchaseFinancials.totalCents)} · Deposit {formatBookingMoney(view.purchaseFinancials.depositCents)} · Outstanding {formatBookingMoney(view.purchaseFinancials.outstandingBalanceCents)} · Venue-attested {formatBookingMoney(view.purchaseFinancials.venueAttestedCents)}</p> : <p>Original purchase balance unavailable.</p>}
    {view.session?.booking && <p className="text-sm">This session: Travel {formatBookingMoney(view.session.booking.travelFeeCents)} · Add-ons {formatBookingMoney(view.session.booking.addonsSubtotalCents)} · Outstanding {formatBookingMoney(view.session.booking.outstandingBalanceCents)} · Venue-attested {formatBookingMoney(view.session.booking.venueAttestedCents)}</p>}
    <p className="text-sm">Management attestation is not independent bank or cash proof. Completion does not confirm payment. The original purchase payment attempt is preserved.</p>
    <OperationHistory view={view} />
    {!view.actionsAvailable && <><div className="flex flex-wrap gap-2">{["Full", "Partial", "Not paid"].map((label) => <button type="button" key={label} disabled className={packageSecondaryCta}>{label} — unavailable</button>)}</div>
    <PackageUnavailable /></>}</section>;
}

export function OperationHistory({ view }: { view: Pick<OwnedPackageView, "operations" | "payments"> }) {
  return <div className="space-y-3 text-sm">{view.operations?.map((operation, index) => <section key={index} className="rounded-xl bg-[#F5F4EE] p-4">
    <p>{operation.action} · {operation.state} · {operation.resultStatus ?? "Result unconfirmed / recovery pending"}</p>
    {operation.amountCents !== null && <p>Independent amount {formatBookingMoney(operation.amountCents)}</p>}
    {operation.disclosure && <pre className="whitespace-pre-wrap break-words font-poppins">{operation.disclosure}</pre>}
    {operation.sessionAcceptanceRecordedAt && <p>Independent session dues acceptance recorded: {new Date(operation.sessionAcceptanceRecordedAt).toISOString()}</p>}
    <p>Notification state: {operation.notificationStates.join(", ") || "Not recorded"}. External delivery is not attested.</p>
  </section>)}{view.payments?.map((payment, index) => <section key={index} className="rounded-xl border p-4">
    <p>{payment.kind} · {payment.amountCents === null ? "Amount unavailable" : formatBookingMoney(payment.amountCents)}</p>
    <PaymentStatus state={payment.providerState} /><p>Booking persistence: {payment.persistenceState}</p>
    {payment.compensationState !== "NOT_REQUIRED" && <PaymentStatus state={payment.compensationState} />}
  </section>)}</div>;
}
