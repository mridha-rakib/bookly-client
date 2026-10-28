"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { packageLifecycleApi, packageLifecycleError, type PackageLifecycleAction, type PackageLifecycleRequest, type PackageLifecycleResult, type PackageSessionQuote, type PackageSessionSelection } from "@/lib/api/package-lifecycle";
import type { OwnedPackageView } from "@/lib/api/package-views";
import { getStripe } from "@/lib/payments/stripe-client";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useAuthStore } from "@/lib/auth/store";
import { bookingsApi, type RescheduleAvailabilityResult } from "@/lib/api/bookings";
import { bookingKeys } from "@/lib/bookings/hooks";

/** Stateful transport around the existing domain API. A response must say COMMITTED before
 * this view confirms a Booking. An uncertain request remains frozen for identical replay. */
export function FirstClassLifecycleControls({ pkg }: { pkg: OwnedPackageView }) {
  const cache = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const storageKey = `bookly:package-session:v1:${userId}:${pkg.id}`;
  const [item, setItem] = useState("");
  const [date, setDate] = useState("");
  const [selection, setSelection] = useState<PackageSessionSelection>();
  const [staff, setStaff] = useState("");
  const [start, setStart] = useState("");
  const [method, setMethod] = useState<"VENUE" | "ONLINE">("VENUE");
  const [addons, setAddons] = useState<string[]>([]);
  const [address, setAddress] = useState({ city: "", area: "", streetName: "", streetNumber: "", propertyType: "Apartment", floorUnit: "", aptRoom: "", additionalDirections: "" });
  const [quote, setQuote] = useState<PackageSessionQuote>();
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [request, setRequest] = useState<PackageLifecycleRequest>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PackageLifecycleResult>();
  const [dispatched, setDispatched] = useState(false);
  const [restored, setRestored] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let active = true, dispatchedRequest: PackageLifecycleRequest | undefined;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.request?.businessId === pkg.businessId && saved.request?.packageProgressId === pkg.id && typeof saved.request.key === "string") {
          setRequest(saved.request); setQuote(saved.quote); setAccepted(saved.accepted === true);
          setChecked(saved.accepted === true); setDispatched(saved.dispatched === true);
          if (saved.dispatched === true) { setResult({ state: "UNRESOLVED" }); dispatchedRequest = saved.request; }
        }
      }
    } catch { /* Storage unavailable: identical retries remain possible while mounted. */ }
    setRestored(true);
    // A dispatched request may have committed before the reload or a lost response. Ask the
    // server once (read-only) for the exact original operation; never resend the booking.
    if (dispatchedRequest) {
      setRecovering(true);
      void packageLifecycleApi.redemptionStatus(dispatchedRequest).then(async (status) => {
        if (!active || status.state !== "COMMITTED") return;
        setResult(status);
        await refresh();
      }).catch(() => { /* Stay UNRESOLVED; the explicit identical retry remains available. */ })
        .finally(() => { if (active) setRecovering(false); });
    }
    return () => { active = false; };
    // refresh only invalidates shared query keys; recovery runs once per restored identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, pkg.businessId, pkg.id]);
  useEffect(() => {
    if (!restored) return;
    try {
      if (request) sessionStorage.setItem(storageKey, JSON.stringify({ request, quote, accepted, dispatched }));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Never interpret storage failure as an HTTP outcome. */ }
  }, [storageKey, restored, request, quote, accepted, dispatched, result]);
  const available = pkg.purchaseCompletion === "VERIFIED" && pkg.purchaseFinancials?.balanceSettled && pkg.status !== "VOIDED" &&
    !(pkg.validity?.expiresAt && Date.now() >= Date.parse(pkg.validity.expiresAt)) && pkg.items.some((i) => i.remaining > 0);
  const enabled = (available || dispatched) && pkg.actionsAvailable && restored;
  async function refresh() {
    await Promise.all([cache.invalidateQueries({ queryKey: ["packageViews"] }),
      cache.invalidateQueries({ queryKey: bookingKeys.all }), cache.invalidateQueries({ queryKey: bookingKeys.customerAll }),
      cache.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability })]);
  }
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await work(); } catch (e) { setError(packageLifecycleError(e)); } finally { setBusy(false); }
  }
  function resetSelection() { setSelection(undefined); setStaff(""); setStart(""); setAddons([]); }
  const scope = { businessId: pkg.businessId, packageProgressId: pkg.id };
  const cities = pkg.items.find((i) => i.id === item)?.travelCities ?? [];
  const travel = cities.length > 0;
  return <section className="space-y-3 rounded-xl border p-4" aria-label="Remaining session booking">
    <h2 className="text-lg font-bold">Book a remaining session</h2>
    {!enabled && <p role="status">{available ? "Package lifecycle activation is pending. Booking is unavailable." : "Verified purchase, settled original balance and unexpired remaining credits are required."}</p>}
    <fieldset disabled={!enabled || busy || Boolean(request)} className="space-y-3">
      <label className="block">Purchased service<select aria-label="Purchased service" value={item} onChange={(e) => { setItem(e.target.value); resetSelection(); }}><option value="">Select a service</option>{pkg.items.filter((i) => i.remaining > 0).map((i) => <option key={i.id} value={i.id}>{i.name} · {i.remaining} remaining</option>)}</select></label>
      <label className="block">Date<input aria-label="Session date" type="date" value={date} onChange={(e) => { setDate(e.target.value); resetSelection(); }} /></label>
      {travel && <fieldset><legend>Travel address for this session</legend>
        <label>City<select aria-label="Session travel city" value={address.city} onChange={(e) => { setAddress({ ...address, city: e.target.value }); resetSelection(); }}><option value="">Select purchased city</option>{cities.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}</select></label>
        {(["area", "streetName", "streetNumber", "floorUnit", "aptRoom", "additionalDirections"] as const).map((field) => <label className="block" key={field}>{field}<input aria-label={`Session travel ${field}`} value={address[field]} onChange={(e) => { setAddress({ ...address, [field]: e.target.value }); resetSelection(); }} /></label>)}
        <label>Property type<select value={address.propertyType} onChange={(e) => { setAddress({ ...address, propertyType: e.target.value }); resetSelection(); }}>{["Apartment", "Villa", "House", "Hotel", "Office", "Other"].map((p) => <option key={p}>{p}</option>)}</select></label>
      </fieldset>}
      <button type="button" disabled={!item || !date || (travel && (!address.city || !address.area || !address.streetName || !address.streetNumber))} onClick={() => void run(async () => setSelection(await packageLifecycleApi.selection({ ...scope, packageItemId: item, fromDate: date, toDate: date, ...(travel ? { travelAddress: address } : {}) })))}>Find professionals and times</button>
      <label className="block">Professional<select aria-label="Professional" value={staff} onChange={(e) => { setStaff(e.target.value); setStart(""); }}><option value="">Select a professional</option>{selection?.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block">Appointment time<select aria-label="Appointment time" value={start} onChange={(e) => setStart(e.target.value)}><option value="">Select a time</option>{selection?.days.flatMap((d) => d.slots).filter((s) => s.eligibleStaffMembershipIds.includes(staff)).map((s) => <option key={s.startAt} value={s.startAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: selection.timezone }).format(new Date(s.startAt))} ({selection.timezone})</option>)}</select></label>
      <label className="block">Session payment<select aria-label="Session payment" value={method} onChange={(e) => setMethod(e.target.value as "VENUE" | "ONLINE")}><option value="VENUE">At venue</option><option value="ONLINE">Online</option></select></label>
      {selection?.addons.map((addon) => <label className="block" key={addon.id}><input type="checkbox" checked={addons.includes(addon.id)} onChange={(e) => setAddons(e.target.checked ? [...addons, addon.id] : addons.filter((id) => id !== addon.id))} />{addon.name} · {formatBookingMoney(addon.priceCents)} (confirmed by session quote)</label>)}
      <button type="button" disabled={!staff || !start} onClick={() => void run(async () => {
        const input = { ...scope, key: crypto.randomUUID(), packageItemId: item, staffMembershipId: staff, startAt: start, dues: { addonIds: addons, paymentMethod: method, ...(travel ? { travelAddress: address } : {}) } };
        // Freeze before sending: a lost response replays the same operation key.
        setRequest(input);
        try { sessionStorage.setItem(storageKey, JSON.stringify({ request: input, dispatched: false })); } catch { /* Identical key stays in component state. */ }
        setQuote(await packageLifecycleApi.quote(input));
      })}>Review exact session terms</button>
    </fieldset>
    {request && !quote && <button type="button" disabled={busy || !enabled} onClick={() => void run(async () => setQuote(await packageLifecycleApi.quote(request)))}>Retry same terms request</button>}
    {quote && request && <div className="space-y-3">
      <pre className="whitespace-pre-wrap" aria-label="Exact session disclosure">{quote.disclosure}</pre>
      <p>Included base {formatBookingMoney(0)} · Travel {formatBookingMoney(quote.travelCents)} · Add-ons {formatBookingMoney(quote.addonsCents)} · Total {formatBookingMoney(quote.totalCents)}</p>
      <label><input type="checkbox" checked={checked} disabled={busy || accepted} onChange={(e) => setChecked(e.target.checked)} />I accept these exact independent session dues and terms.</label>
      {!accepted && <button type="button" disabled={!checked || busy || !enabled} onClick={() => void run(async () => { await packageLifecycleApi.accept(request, quote); setAccepted(true); })}>Accept session terms</button>}
      {accepted && result?.state !== "COMMITTED" && <button type="button" disabled={busy || recovering || !enabled} onClick={() => void run(async () => {
        setDispatched(true);
        try { sessionStorage.setItem(storageKey, JSON.stringify({ request, quote, accepted, dispatched: true })); } catch { /* Keep the same mounted request. */ }
        setResult(await packageLifecycleApi.execute("redeem", request)); await refresh();
      })}>{dispatched ? "Retry same booking request" : "Confirm session booking"}</button>}
    </div>}
    {recovering && <p role="status">Checking the original booking request with the server…</p>}
    <LifecycleResult result={result} />
    {request && !dispatched && !result && <button type="button" disabled={busy} onClick={() => { setRequest(undefined); setQuote(undefined); setChecked(false); setAccepted(false); setError(""); }}>Choose new session terms</button>}
    {result?.state === "COMMITTED" && <button type="button" onClick={() => { setRequest(undefined); setResult(undefined); setQuote(undefined); setDispatched(false); setAccepted(false); setChecked(false); resetSelection(); }}>Book another remaining session</button>}
    {result?.state === "PAYMENT_PENDING" && result.clientSecret && <button type="button" disabled={busy || !enabled} onClick={() => void run(async () => {
      const stripe = await getStripe(); if (!stripe) throw Error("Payment unavailable");
      const confirmation = await stripe.confirmCardPayment(result.clientSecret!);
      if (confirmation.error) throw confirmation.error;
      // Browser payment confirmation does not establish the Booking; replay the same service operation.
      if (request) { setResult(await packageLifecycleApi.execute("redeem", request)); await refresh(); }
    })}>Continue secure payment</button>}
    {error && <p role="alert">{error}</p>}
    {!request && <p className="text-sm">The bundle is not charged again. Availability is rechecked when the Booking commits.</p>}
  </section>;
}

export function LifecycleResult({ result }: { result?: PackageLifecycleResult }) {
  if (!result) return null;
  if (result.state === "COMMITTED") return <p role="status">Server committed: {result.status}{result.bookingId ? ` · Booking ${result.bookingId}` : ""}.</p>;
  if (result.state === "PAYMENT_PENDING") return <p role="status">{["failed", "requires_payment_method", "canceled"].includes(result.providerStatus) ? "Session payment failed or needs a payment method" : "Session payment pending"}: {result.providerStatus}. Booking unconfirmed; retry the same request after payment recovery.</p>;
  return <p role="status">Operation unresolved. Booking and credit outcome unconfirmed. Retry the identical request.</p>;
}

/** Exact per-user, per-Business, per-Package, per-Booking, per-role key of one retained action. */
export const sessionActionStorageKey = (userId: string | undefined, businessId: string, progressId: string, bookingId: string | undefined, management: boolean) =>
  `bookly:package-action:v1:${userId}:${businessId}:${progressId}:${bookingId ?? "expiry"}:${management}`;

export function FirstClassSessionActions({ businessId, progressId, bookingId, enabled, management = false, onRetired }: {
  businessId: string; progressId: string; bookingId?: string; enabled: boolean; management?: boolean;
  /** Set for a recovery-only control (Booking no longer upcoming): a proven COMMITTED retires it. */
  onRetired?: () => void;
}) {
  const cache = useQueryClient();
  const [pending, setPending] = useState<{ action: PackageLifecycleAction; input: PackageLifecycleRequest }>();
  const [action, setAction] = useState<PackageLifecycleAction>(bookingId ? "cancel" : "expire");
  const [startAt, setStartAt] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [moveSlots, setMoveSlots] = useState<RescheduleAvailabilityResult>();
  const [settlement, setSettlement] = useState<"FULL" | "PARTIAL" | "NOT_PAID">("NOT_PAID");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PackageLifecycleResult>();
  const userId = useAuthStore((s) => s.user?.id);
  const storageKey = sessionActionStorageKey(userId, businessId, progressId, bookingId, management);
  const [restored, setRestored] = useState(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let active = true, dispatched: { action: PackageLifecycleAction; input: PackageLifecycleRequest } | undefined;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.input?.businessId === businessId && saved.input?.packageProgressId === progressId && typeof saved.input?.key === "string") {
          setPending(saved); setAction(saved.action); setStartAt(saved.input.startAt ?? ""); setConfirmed(true); setResult({ state: "UNRESOLVED" });
          dispatched = saved;
        }
      }
    } catch { /* Storage is advisory; the server verifies every retry. */ }
    setRestored(true);
    // The saved request may already have committed (reload or lost response). A Customer asks the
    // server once, read-only, about that exact operation; the action itself is never resent.
    const name = dispatched?.action;
    if (dispatched && name && name !== "redeem") {
      setRecovering(true);
      void packageLifecycleApi.actionStatus(name, dispatched.input).then(async (status) => {
        if (!active || status.state !== "COMMITTED") return;
        setResult(status);
        if (retires(name)) retire();
        await invalidate();
      }).catch(() => { /* Stay UNRESOLVED; the explicit identical retry remains available. */ })
        .finally(() => { if (active) setRecovering(false); });
    }
    return () => { active = false; };
    // invalidate only touches shared query keys; recovery runs once per restored identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, businessId, progressId]);
  async function invalidate() {
    await cache.invalidateQueries({ queryKey: ["packageViews"] }); await cache.invalidateQueries({ queryKey: ["bookings"] });
    await cache.invalidateQueries({ queryKey: bookingKeys.customerAll });
    await cache.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability });
  }
  // Only a server-proven COMMITTED outcome retires a retained request: a Customer cancellation
  // (its Booking leaves the upcoming list, so no control would show it again) or any
  // recovery-only control. Unresolved requests are never retired.
  function retires(name: PackageLifecycleAction) { return Boolean(onRetired) || (!management && name === "cancel"); }
  function retire() {
    try { sessionStorage.removeItem(storageKey); } catch { /* Local only. */ }
    setPending(undefined); onRetired?.();
  }
  async function submit() {
    if (busy) return;
    const intent = pending ?? { action, input: { businessId, packageProgressId: progressId, key: crypto.randomUUID(),
      ...(action !== "expire" && bookingId ? { bookingId } : {}),
      ...(action === "reschedule" ? { startAt } : {}),
      ...(action === "settlement" ? { venuePayment: { settlement, ...(settlement === "PARTIAL" ? { amountCents: Number(amount) } : {}) } } : {}) } };
    setPending(intent); setBusy(true); setError("");
    try { sessionStorage.setItem(storageKey, JSON.stringify(intent)); } catch { /* Retain the mounted request key. */ }
    try { const response = await packageLifecycleApi.execute(intent.action, intent.input);
      setResult(response);
      if (response.state === "COMMITTED" && retires(intent.action)) retire();
      await invalidate();
    } catch (e) { setError(packageLifecycleError(e)); } finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded border p-3" aria-label="Package session actions">
    {bookingId && <p>Appointment {bookingId}</p>}
    {!enabled && <p role="status">Package actions unavailable pending activation.</p>}
    <fieldset disabled={!enabled || !restored || busy || Boolean(pending)}>
      <label>Action<select aria-label="Package session action" value={action} onChange={(e) => { setAction(e.target.value as PackageLifecycleAction); setConfirmed(false); }}>
        {bookingId && <><option value="cancel">Cancel appointment</option><option value="reschedule">Reschedule appointment</option></>}
        <option value="expire">Reconcile expired credits</option>
        {management && bookingId && <><option value="complete">Complete</option><option value="mark-no-show">Mark no-show for review</option><option value="no-show">Resolve no-show after deadline</option><option value="reverse-no-show">Reverse no-show</option><option value="settlement">Record venue settlement</option></>}
      </select></label>
      {action === "reschedule" && <><label>New date<input aria-label="New appointment date" type="date" value={moveDate} onChange={(e) => { setMoveDate(e.target.value); setMoveSlots(undefined); setStartAt(""); }} /></label>
        <button type="button" disabled={!moveDate} onClick={() => { setBusy(true); setError(""); void bookingsApi.getRescheduleAvailability(management ? "business" : "customer", businessId, bookingId!, { fromDate: moveDate, toDate: moveDate }).then(setMoveSlots).catch((e) => setError(packageLifecycleError(e))).finally(() => setBusy(false)); }}>Find new appointment times</button>
        <label>New time<select aria-label="New appointment instant" value={startAt} onChange={(e) => setStartAt(e.target.value)}><option value="">Select an available time</option>{moveSlots?.days.flatMap((d) => d.slots).map((s) => <option key={s.startAt} value={s.startAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: moveSlots.timezone }).format(new Date(s.startAt))} ({moveSlots.timezone})</option>)}</select></label></>}
      {action === "settlement" && <><label>Venue settlement<select value={settlement} onChange={(e) => setSettlement(e.target.value as typeof settlement)}><option value="NOT_PAID">Not paid</option><option value="FULL">Full</option><option value="PARTIAL">Partial</option></select></label>{settlement === "PARTIAL" && <label>Received amount (cents)<input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}</>}
      <p>Cancellation follows the purchased policy: credits may be restored, expired or forfeited; a separate authorized penalty may apply. Completion does not attest payment.</p>
      <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Confirm this action under the purchased terms.</label>
    </fieldset>
    {recovering && <p role="status">Checking the original action with the server…</p>}
    <button type="button" disabled={!enabled || !restored || !confirmed || busy || recovering || result?.state === "COMMITTED" || (action === "reschedule" && !startAt)} onClick={() => void submit()}>{busy ? "Submitting…" : pending ? "Retry identical action" : "Submit package action"}</button>
    {result?.state === "COMMITTED" && <button type="button" onClick={() => { try { sessionStorage.removeItem(storageKey); } catch { /* Local only. */ } setPending(undefined); setResult(undefined); setConfirmed(false); }}>Choose another action</button>}
    <LifecycleResult result={result} />{error && <p role="alert">{error}</p>}
  </section>;
}
