"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { bookingsApi, type BookingPaymentStatus, type BookingRecoveryInboxItem, type BookingRecoveryInboxPage } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { toUserMessage } from "@/lib/auth/messages";
import { customerPaymentSession } from "@/lib/bookings/payment-session";
import { getStripe } from "@/lib/payments/stripe-client";
import { BOOKING_CONTINUATIONS_CHANGED, dismissBookingRecoveryPointer, readBookingContinuations,
  readBookingRecoveryPointers, type BookingRecoveryPointer, type BookingContinuation } from "@/lib/bookings/payment-continuation";
import { pruneBookingRecoveryStorage, BOOKING_REQUEST_BODY_RETENTION_MS, BOOKING_POINTER_RETENTION_MS } from "@/lib/bookings/payment-continuation";

export const bookingRecoveryMessage = (state: BookingPaymentStatus["state"]) => ({
  NOT_OBSERVED: "No Booking result has been observed yet. This does not prove the original request failed.",
  UNRESOLVED: "Your original Booking request is unresolved. Check its status before starting another booking.",
  AUTHENTICATION_REQUIRED: "Your bank needs additional authentication. Your Booking is not confirmed yet.",
  PAYMENT_PROCESSING: "Your payment is processing. Your Booking is not confirmed yet.",
  FINALIZATION_PENDING: "Payment is confirmed; Booking finalization is still pending. Do not pay again.",
  PAYMENT_FAILED: "Payment failed or was cancelled. Your Booking is not confirmed. Retry only this original request; if it still fails, contact support with its reference.",
  REFUND_PENDING: "Your Booking could not be finalized. Refund or compensation is pending; a refund has not been confirmed.",
  REFUNDED: "The refund for this original request is confirmed. This request cannot create another booking.",
  RECONCILIATION_REQUIRED: "Payment recovery needs attention. Contact support with the original request reference below.",
  COMMITTED: "Your Booking is confirmed by Bookly.",
}[state]);

function RecoveryRequest({ record, operation, initialStatus, session, onResolved, showDismiss = true }: { record?: BookingContinuation;
  operation?: { businessId: string; idempotencyKey: string; businessName?: string }; initialStatus?: BookingPaymentStatus;
  session: string; onResolved?: (status: BookingPaymentStatus) => void; showDismiss?: boolean }) {
  const businessId = record?.businessId ?? operation!.businessId;
  const operationKey = record?.input.idempotencyKey ?? operation!.idempotencyKey;
  const [status, setStatus] = useState<BookingPaymentStatus | undefined>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const current = useRef<object | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current = null; }; }, []);
  useEffect(() => { if (!record && initialStatus) setStatus(initialStatus); }, [initialStatus, Boolean(record)]);
  const live = () => mounted.current && session === customerPaymentSession(useAuthStore.getState());
  const read = async () => {
    const value = await bookingsApi.getCustomerPaymentStatus(businessId, operationKey);
    if (value.businessId !== businessId || value.idempotencyKey !== operationKey)
      throw Error("The returned status does not match your original Booking request.");
    // The SCA secret is never kept in component result state, cache or storage.
    return value;
  };
  const run = async (resume: boolean) => {
    if (current.current || !live()) return;
    const action = {}; current.current = action; setBusy(true); setError(undefined);
    const active = () => live() && current.current === action;
    const display = (value: BookingPaymentStatus) => {
      const { clientSecret: _secret, ...publicStatus } = value;
      if (active()) {
        setStatus(publicStatus); if (value.state === "COMMITTED") setError(undefined);
        if (value.canDismiss || ["COMMITTED", "REFUNDED"].includes(value.state)) onResolved?.(publicStatus);
      }
    };
    try {
      const original = await read();
      display(original);
      if (!active() || !resume || !record || original.canResume === false || original.canDismiss || ["COMMITTED", "REFUND_PENDING", "REFUNDED", "RECONCILIATION_REQUIRED"].includes(original.state)) return;
      const owner = useAuthStore.getState().user?.id;
      const retained = owner && readBookingContinuations(owner).find((r) => r.businessId === businessId && r.input.idempotencyKey === operationKey);
      if (!retained || JSON.stringify(retained.input) !== JSON.stringify(record.input))
        throw Error("The original checkout details are no longer retained in this tab. Check status or contact support; no new request was sent.");
      if (original.state === "AUTHENTICATION_REQUIRED" || (original.state === "PAYMENT_FAILED" && original.clientSecret)) {
        if (!original.clientSecret) throw Error("Authentication details are unavailable. Check the original request again.");
        const stripe = await getStripe();
        if (!active()) return;
        if (!stripe) throw Error("Payment authentication is unavailable. Your original request has been kept.");
        const result = await stripe.confirmCardPayment(original.clientSecret);
        if (!active()) return;
        if (result.error) throw Error(result.error.message ?? "Authentication is incomplete. Your Booking is not confirmed.");
      }
      // Explicit action only. Stripe success never supplies Booking commitment authority.
      await bookingsApi.finalizeCustomerBooking(record.businessId, record.input);
      if (active()) display(await read());
    } catch (cause) {
      if (!active()) return;
      setError(toUserMessage(cause));
      // A failed/lost finalize response can still have committed. Only a read resolves it.
      if (resume) await read().then(display).catch(() => undefined);
    } finally {
      if (active()) setBusy(false);
      if (current.current === action) current.current = null;
    }
  };
  useEffect(() => {
    // Remount/refresh and cross-tab discovery perform reads only, never payment continuation.
    if (record || !initialStatus) void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, operationKey, Boolean(record)]);
  const terminal = status?.state === "COMMITTED" || status?.state === "REFUNDED" || status?.canDismiss === true;
  const canResume = record && status && status.canResume !== false && !terminal && !["REFUND_PENDING", "RECONCILIATION_REQUIRED"].includes(status.state);
  return <article className="rounded-xl border border-[#E8E8E4] bg-white p-5 space-y-3">
    {operation?.businessName && <h3 className="font-semibold">{operation.businessName}</h3>}
    <p role="status" className="text-sm text-[#1C1B1C]">{status ? bookingRecoveryMessage(status.state) : "Checking the original Booking request…"}</p>
    <p className="text-xs break-all text-neutral-600">Original request: {operationKey}</p>
    {record ? <p className="text-xs text-neutral-600">Requested appointment: {record.input.startAt}</p> :
      !terminal && <p className="text-sm">The original checkout details are not retained on this device. Check status or contact support using this reference. A new payment or Booking will not be started here.</p>}
    {status?.resumeBlockedReason === "BUSINESS_UNAVAILABLE" && <p className="text-sm">This venue is not currently accepting bookings. You can still check this request. Contact the venue or support before continuing payment.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3 text-sm">
      <button type="button" disabled={busy} onClick={() => void run(false)} className="rounded-lg border px-4 py-2 disabled:opacity-50">{busy ? "Checking…" : "Check original Booking status"}</button>
      {canResume && status && <button type="button" disabled={busy} onClick={() => void run(true)} className="rounded-lg bg-[#2E9DA7] text-white px-4 py-2 disabled:opacity-50">{status.state === "AUTHENTICATION_REQUIRED" ? "Complete bank authentication" : status.state === "PAYMENT_FAILED" ? "Retry original payment" : "Continue original Booking"}</button>}
      {status?.state === "PAYMENT_FAILED" && <Link href="/customer/payment-card" className="underline py-2">Review saved card</Link>}
      {status?.state === "COMMITTED" && status.bookingId && <Link href={`/customer/bookings/view?id=${encodeURIComponent(status.bookingId)}`} className="underline py-2">View confirmed Booking</Link>}
      {terminal && showDismiss && <button type="button" disabled={busy} onClick={() => {
        const customerId = useAuthStore.getState().user?.id;
        if (live() && customerId && !dismissBookingRecoveryPointer(customerId, businessId, operationKey)) setError("This saved request could not be removed from this browser. Its server status is unchanged.");
      }} className="underline py-2">Dismiss saved request</button>}
    </div>
  </article>;
}

const operationIdentity = (r: { businessId: string; idempotencyKey: string }) => JSON.stringify([r.businessId, r.idempotencyKey]);
const uniqueItems = (items: BookingRecoveryInboxItem[]) => [...new Map(items.map((r) => [operationIdentity(r), r])).values()];
function ServerRecoveryInbox({ session, records, pointers }: { session: string; records: BookingContinuation[]; pointers: BookingRecoveryPointer[] }) {
  const [page, setPage] = useState<BookingRecoveryInboxPage>();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const action = useRef<object | null>(null), mounted = useRef(true);
  const live = () => mounted.current && session === customerPaymentSession(useAuthStore.getState());
  const load = async (cursor?: string) => {
    if (!live() || action.current) return;
    const current = {}; action.current = current; setBusy(true); setError(undefined);
    try {
      const result = await bookingsApi.getCustomerRecoveryInbox({ limit: 10, ...(cursor ? { cursor } : {}) });
      if (!live() || action.current !== current) return;
      if (result.hasMore && !result.nextCursor) throw Error("Recovery history could not be paginated safely.");
      setPage((previous) => {
        const resolved = uniqueItems([...(cursor ? previous?.resolved ?? [] : []), ...result.resolved]);
        const done = new Set(resolved.map(operationIdentity));
        const requests = uniqueItems([...(cursor ? previous?.requests ?? [] : []), ...result.requests]).filter((r) => !done.has(operationIdentity(r)));
        return { ...result, requests, resolved };
      });
    } catch (cause) { if (live() && action.current === current) setError(toUserMessage(cause)); }
    finally { if (live() && action.current === current) setBusy(false); if (action.current === current) action.current = null; }
  };
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; action.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  const moveResolved = (item: BookingRecoveryInboxItem, status: BookingPaymentStatus) => {
    if (!live()) return;
    setPage((previous) => previous && ({ ...previous,
      requests: previous.requests.filter((r) => operationIdentity(r) !== operationIdentity(item)),
      resolved: uniqueItems([...previous.resolved, { ...item, status }]) }));
  };
  const seen = new Set([...(page?.requests ?? []), ...(page?.resolved ?? [])].map(operationIdentity));
  const local = pointers.filter((p) => !seen.has(operationIdentity(p)));
  const bodyFor = (r: { businessId: string; idempotencyKey: string }) => records.find((b) => b.businessId === r.businessId && b.input.idempotencyKey === r.idempotencyKey);
  return <section aria-label="Booking requests needing attention" className="w-full space-y-3">
    <h2 className="font-poppins font-semibold text-xl">Booking Requests Needing Attention</h2>
    <p className="text-sm text-neutral-600">Original requests from your account, including requests started on another device. Checking status does not charge your card.</p>
    <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg border px-4 py-2">{busy ? "Loading requests…" : "Refresh requests"}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error} Your original requests have not been changed.</p>}
    {page && !page.requests.length && <p role="status" className="text-sm">{page.hasMore ? "No requests needing attention in this page. You can load older requests." : "No requests needing attention in the history checked."}</p>}
    {(page?.requests ?? []).map((item) => <RecoveryRequest key={operationIdentity(item)} operation={item}
      initialStatus={item.status} record={bodyFor(item)} session={session} onResolved={(status) => moveResolved(item, status)} />)}
    {page?.hasMore && <button type="button" disabled={busy} onClick={() => void load(page.nextCursor)} className="rounded-lg border px-4 py-2">Load older requests</button>}
    {Boolean(page?.resolved.length) && <section aria-label="Resolved Booking requests" className="space-y-3">
      <h3 className="font-semibold">Resolved requests</h3>
      {page!.resolved.map((item) => <RecoveryRequest key={operationIdentity(item)} operation={item} initialStatus={item.status}
        session={session} showDismiss={pointers.some((p) => operationIdentity(p) === operationIdentity(item))} />)}
    </section>}
    {local.length > 0 && <section aria-label="Saved requests in this browser" className="space-y-3">
      <h3 className="font-semibold">Saved requests in this browser</h3>
      {local.map((pointer) => <RecoveryRequest key={operationIdentity(pointer)} operation={pointer} record={bodyFor(pointer)} session={session} />)}
    </section>}
  </section>;
}

/** A local request list is advisory; authenticated server facts decide every displayed result. */
export default function BookingPaymentRecovery({ businessId, serverInbox = false }: { businessId?: string; serverInbox?: boolean }) {
  const session = useAuthStore(customerPaymentSession);
  const customerId = useAuthStore((s) => s.user?.id);
  const authStatus = useAuthStore((s) => s.status);
  const [records, setRecords] = useState<BookingContinuation[]>([]);
  const [pointers, setPointers] = useState<BookingRecoveryPointer[]>([]);
  useEffect(() => {
    const refresh = () => {
      if (!session && authStatus === "unauthenticated") pruneBookingRecoveryStorage("");
      setRecords(session && customerId ? readBookingContinuations(customerId).filter((r) => !businessId || r.businessId === businessId) : []);
      setPointers(session && customerId ? readBookingRecoveryPointers(customerId).filter((r) => !businessId || r.businessId === businessId) : []);
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(BOOKING_CONTINUATIONS_CHANGED, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(BOOKING_CONTINUATIONS_CHANGED, refresh); };
  }, [session, customerId, businessId, authStatus]);
  useEffect(() => {
    const expiries = [...records.map((r) => r.savedAt + BOOKING_REQUEST_BODY_RETENTION_MS),
      ...pointers.map((p) => p.savedAt + BOOKING_POINTER_RETENTION_MS)];
    if (!expiries.length || !session) return;
    const timer = window.setTimeout(() => window.dispatchEvent(new Event(BOOKING_CONTINUATIONS_CHANGED)),
      Math.max(1, Math.min(...expiries) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [records, pointers, session]);
  if (!session || !customerId) return null;
  const ownedRecords = records.filter((r) => r.customerId === customerId), ownedPointers = pointers.filter((r) => r.customerId === customerId);
  if (serverInbox) return <ServerRecoveryInbox key={session} session={session} records={ownedRecords} pointers={ownedPointers} />;
  if (!ownedPointers.length) return null;
  return <section aria-label="Booking payment recovery" className="w-full space-y-3">
    <h2 className="font-poppins font-semibold text-xl">Continue your Booking</h2>
    <p className="text-sm text-neutral-600">These are saved original requests. Checking status does not charge your card. If your selected time is no longer available, resolve any payment or refund before choosing a new time.</p>
    {ownedPointers.map((pointer) => <RecoveryRequest key={`${session}:${operationIdentity(pointer)}`} operation={pointer}
      record={ownedRecords.find((r) => r.businessId === pointer.businessId && r.input.idempotencyKey === pointer.idempotencyKey)} session={session} />)}
  </section>;
}
