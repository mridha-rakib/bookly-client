"use client";
/* eslint-disable react-hooks/set-state-in-effect */

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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const statusTone = (state?: BookingPaymentStatus["state"]) => {
    switch (state) {
      case "COMMITTED":
      case "REFUNDED":
        return { badge: "bg-[#CFFED6] text-[#093213] border-[#A8F2B5]", label: state === "COMMITTED" ? "Confirmed" : "Refunded" };
      case "AUTHENTICATION_REQUIRED":
        return { badge: "bg-[#FEF8CF] text-[#7A4B00] border-[#F4E185]", label: "Action Required" };
      case "PAYMENT_FAILED":
        return { badge: "bg-red-50 text-red-700 border-red-200", label: "Payment Failed" };
      case "PAYMENT_PROCESSING":
      case "FINALIZATION_PENDING":
        return { badge: "bg-[#CFE1FE] text-[#091C32] border-[#ADCFFE]", label: "Processing" };
      default:
        return { badge: "bg-[#F1EDED] text-[#45474B] border-[#E2E1E6]", label: "Attention" };
    }
  };

  const tone = statusTone(status?.state);

  return (
    <article className="rounded-xl border border-[#E2E1E6] bg-white p-5 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-[#D0CED6] transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {operation?.businessName ? (
          <h3 className="font-manrope font-bold text-base text-[#020305]">{operation.businessName}</h3>
        ) : (
          <h3 className="font-manrope font-bold text-sm text-[#111827]">Booking Request</h3>
        )}
        {status?.state && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tone.badge}`}>
            {tone.label}
          </span>
        )}
      </div>

      <p role="status" className="text-sm font-bold text-[#020305] leading-relaxed">
        {status ? bookingRecoveryMessage(status.state) : "Checking the original Booking request…"}
      </p>

      <p className="text-xs break-all font-mono font-medium text-[#111827] bg-[#F3F4F6] px-2.5 py-1.5 rounded border border-[#D1D5DB]">
        Original request: {operationKey}
      </p>

      {record ? (
        <p className="text-xs font-semibold text-[#111827]">Requested appointment: {record.input.startAt}</p>
      ) : !terminal ? (
        <p className="text-xs font-medium text-[#111827] bg-[#F3F4F6] p-2.5 rounded-lg border border-[#D1D5DB]">
          The original checkout details are not retained on this device. Check status or contact support using this reference. A new payment or Booking will not be started here.
        </p>
      ) : null}

      {status?.resumeBlockedReason === "BUSINESS_UNAVAILABLE" && (
        <p className="text-xs sm:text-sm text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          This venue is not currently accepting bookings. You can still check this request. Contact the venue or support before continuing payment.
        </p>
      )}

      {error && <p role="alert" className="text-sm text-red-700 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">{error}</p>}

      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-sm font-manrope">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(false)}
          className="rounded-lg border border-[#9CA3AF] bg-white hover:bg-neutral-100 text-[#020305] font-bold text-xs sm:text-sm px-4 py-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {busy ? "Checking…" : "Check original Booking status"}
        </button>

        {canResume && status && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(true)}
            className="rounded-lg bg-[#2E9DA7] hover:bg-[#25838B] text-white font-semibold text-xs sm:text-sm px-4 py-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {status.state === "AUTHENTICATION_REQUIRED"
              ? "Complete bank authentication"
              : status.state === "PAYMENT_FAILED"
              ? "Retry original payment"
              : "Continue original Booking"}
          </button>
        )}

        {status?.state === "PAYMENT_FAILED" && (
          <Link href="/customer/payment-card" className="text-[#2E9DA7] font-semibold text-xs sm:text-sm hover:underline py-2 px-1">
            Review saved card
          </Link>
        )}

        {status?.state === "COMMITTED" && status.bookingId && (
          <Link
            href={`/customer/bookings/view?id=${encodeURIComponent(status.bookingId)}`}
            className="text-[#0D7A82] font-bold text-xs sm:text-sm hover:underline py-2 px-1 flex items-center gap-1"
          >
            <span>View confirmed Booking</span>
            <span>→</span>
          </Link>
        )}

        {terminal && showDismiss && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const customerId = useAuthStore.getState().user?.id;
              if (live() && customerId && !dismissBookingRecoveryPointer(customerId, businessId, operationKey))
                setError("This saved request could not be removed from this browser. Its server status is unchanged.");
            }}
            className="text-[#111827] font-semibold hover:text-[#020305] underline text-xs py-2 px-1 cursor-pointer transition-colors"
          >
            Dismiss saved request
          </button>
        )}
      </div>
    </article>
  );
}

const operationIdentity = (r: { businessId: string; idempotencyKey: string }) => JSON.stringify([r.businessId, r.idempotencyKey]);
const uniqueItems = (items: BookingRecoveryInboxItem[]) => [...new Map(items.map((r) => [operationIdentity(r), r])).values()];
function ServerRecoveryInbox({ session, records, pointers }: { session: string; records: BookingContinuation[]; pointers: BookingRecoveryPointer[] }) {
  const [page, setPage] = useState<BookingRecoveryInboxPage>();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const [isResolvedOpen, setIsResolvedOpen] = useState(false);
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
  return (
    <section aria-label="Booking requests needing attention" className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4 font-manrope">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[#F1EFEC]">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-manrope font-bold text-lg text-[#020305]">Booking Requests Needing Attention</h2>
            {Boolean(page?.requests?.length) && (
              <span className="bg-[#FEF8CF] text-[#7A4B00] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#F4E185]">
                {page!.requests.length} action required
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#1F2937] font-medium mt-1 leading-relaxed">
            Original requests from your account, including requests started on another device. Checking status does not charge your card.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="self-start sm:self-auto rounded-lg border border-[#9CA3AF] bg-white hover:bg-neutral-100 text-[#020305] font-bold text-xs sm:text-sm px-4 py-2 transition-colors disabled:opacity-50 shrink-0 cursor-pointer shadow-sm"
        >
          {busy ? "Loading requests…" : "Refresh requests"}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 font-medium bg-red-50 p-3 rounded-lg border border-red-200">{error} Your original requests have not been changed.</p>}

      {page && !page.requests.length && (
        <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#111827] font-semibold bg-[#F9FAFB] px-4 py-3 rounded-xl border border-[#D1D5DB]">
          <svg className="w-4 h-4 text-[#30AE5A] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span role="status">{page.hasMore ? "No requests needing attention in this page. You can load older requests." : "No requests needing attention in the history checked."}</span>
        </div>
      )}

      {(page?.requests ?? []).map((item) => (
        <RecoveryRequest
          key={operationIdentity(item)}
          operation={item}
          initialStatus={item.status}
          record={bodyFor(item)}
          session={session}
          onResolved={(status) => {
            moveResolved(item, status);
            setIsResolvedOpen(true);
          }}
        />
      ))}

      {page?.hasMore && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void load(page.nextCursor)}
          className="rounded-lg border border-[#9CA3AF] bg-white hover:bg-neutral-50 px-4 py-2 text-sm font-bold text-[#020305] transition-colors cursor-pointer"
        >
          Load older requests
        </button>
      )}

      {Boolean(page?.resolved.length) && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsResolvedOpen((v) => !v)}
            className="flex items-center justify-between w-full py-2.5 px-3.5 rounded-xl bg-[#F8F7F4] hover:bg-[#EFECE8] text-[#020305] font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-[#D1D5DB]"
            aria-expanded={isResolvedOpen}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[#30AE5A]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Resolved requests ({page!.resolved.length})</span>
            </span>
            <span className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
              <span>{isResolvedOpen ? "Hide history" : "Show history"}</span>
              <svg className={`w-3.5 h-3.5 transform transition-transform duration-200 ${isResolvedOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          <section
            aria-label="Resolved Booking requests"
            className={`space-y-3 mt-3 ${isResolvedOpen ? "block" : "hidden"}`}
          >
            <h3 className="sr-only font-semibold">Resolved requests</h3>
            {page!.resolved.map((item) => (
              <RecoveryRequest
                key={operationIdentity(item)}
                operation={item}
                initialStatus={item.status}
                session={session}
                showDismiss={pointers.some((p) => operationIdentity(p) === operationIdentity(item))}
              />
            ))}
          </section>
        </div>
      )}

      {local.length > 0 && (
        <section aria-label="Saved requests in this browser" className="space-y-3 pt-3 border-t border-[#F1EFEC]">
          <h3 className="font-semibold text-sm text-[#020305]">Saved requests in this browser</h3>
          {local.map((pointer) => (
            <RecoveryRequest
              key={operationIdentity(pointer)}
              operation={pointer}
              record={bodyFor(pointer)}
              session={session}
            />
          ))}
        </section>
      )}
    </section>
  );
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
  return (
    <section aria-label="Booking payment recovery" className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4 font-manrope">
      <div>
        <h2 className="font-manrope font-bold text-lg text-[#020305]">Continue your Booking</h2>
        <p className="text-xs sm:text-sm text-[#45474B] mt-1 leading-relaxed">
          These are saved original requests. Checking status does not charge your card. If your selected time is no longer available, resolve any payment or refund before choosing a new time.
        </p>
      </div>
      <div className="space-y-3">
        {ownedPointers.map((pointer) => (
          <RecoveryRequest
            key={`${session}:${operationIdentity(pointer)}`}
            operation={pointer}
            record={ownedRecords.find((r) => r.businessId === pointer.businessId && r.input.idempotencyKey === pointer.idempotencyKey)}
            session={session}
          />
        ))}
      </div>
    </section>
  );
}
