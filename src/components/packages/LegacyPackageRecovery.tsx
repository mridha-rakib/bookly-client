"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/store";
import { customerPaymentSession } from "@/lib/bookings/payment-session";
import { toUserMessage } from "@/lib/auth/messages";
import { continueLegacyRecovery, LEGACY_RECOVERY_CHANGED, observeLegacyRecovery, readLegacyRecovery,
  resolveLegacyRecovery, type LegacyPointer, type LegacyRecord, type LegacyStatus } from "@/lib/packages/legacy-recovery";

function Request({ pointer, record, session, onResolved }: { pointer: LegacyPointer; record?: LegacyRecord; session: string;
  onResolved?: (pointer: LegacyPointer, status: LegacyStatus) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LegacyStatus>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const action = useRef(false), mounted = useRef(false), observation = useRef(0);
  const live = useCallback(() => mounted.current && session === customerPaymentSession(useAuthStore.getState()) &&
    useAuthStore.getState().user?.id === pointer.customerId, [session, pointer.customerId]);
  const run = async (resume = false) => {
    if (!live() || action.current) return;
    const ticket = ++observation.current;
    action.current = true; setBusy(true); setError(undefined);
    try {
      const result = resume && record ? await continueLegacyRecovery(record, live) : await observeLegacyRecovery(pointer);
      if (live() && observation.current === ticket) {
        setStatus(result);
        if (result.state === "COMMITTED") {
          void queryClient.invalidateQueries({ queryKey: ["packages"] });
          void queryClient.invalidateQueries({ queryKey: ["customerBookings", "list"] });
        }
      }
    } catch (cause) { if (live()) setError(toUserMessage(cause)); }
    finally { action.current = false; if (live()) setBusy(false); }
  };
  useEffect(() => {
    mounted.current = true;
    const ticket = ++observation.current;
    void observeLegacyRecovery(pointer).then((result) => {
      if (live() && observation.current === ticket) setStatus(result);
    }, (cause: unknown) => {
      if (live() && observation.current === ticket) setError(toUserMessage(cause));
    });
    return () => { mounted.current = false; };
  }, [live, pointer]);
  return <article className="rounded-xl border p-4 space-y-3">
    <h3 className="font-semibold">{pointer.kind === "PACKAGE_PURCHASE" ? "Original package purchase" : "Original package session"}</h3>
    <p role="status">{status?.state === "COMMITTED" ? "Your original booking is confirmed." :
      status?.state === "REFUNDED" ? "The original request was refunded. No booking was confirmed." :
      status?.state === "AUTHENTICATION_REQUIRED" ? "Bank authentication is required for the original request." :
      status?.canDismiss ? "The original request is resolved without a confirmed booking." :
      "The original request is not confirmed yet. Check its status before trying again."}</p>
    <p className="text-xs break-all">Request: {pointer.idempotencyKey}</p>
    {error && <p role="alert">{error} Your original request is retained.</p>}
    {!record && <p>Original checkout details are unavailable. Status checks are safe; contact support if this request remains unresolved.</p>}
    <button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-2">Check package request</button>
    {record && status?.canResume && <button type="button" disabled={busy} onClick={() => void run(true)} className="rounded border px-3 py-2">Continue original package request</button>}
    {status?.state === "COMMITTED" && status.bookingId && <Link className="block underline" href={`/customer/bookings/view?id=${encodeURIComponent(status.bookingId)}`}>View confirmed booking</Link>}
    {status?.state === "COMMITTED" && status.packageProgressId && <Link className="block underline" href="/customer/packages">View package progress</Link>}
    {status?.canDismiss && <button type="button" disabled={busy} onClick={() => {
      if (!live()) return;
      try { resolveLegacyRecovery(pointer, status); onResolved?.(pointer, status); } catch (cause) { setError(toUserMessage(cause)); }
    }} className="rounded border px-3 py-2">Dismiss resolved package request</button>}
  </article>;
}

export default function LegacyPackageRecovery({ businessId, packageId, onResolved }: { businessId?: string; packageId?: string;
  onResolved?: (pointer: LegacyPointer, status: LegacyStatus) => void }) {
  const session = useAuthStore(customerPaymentSession);
  const customerId = useAuthStore((state) => state.user?.id);
  const authStatus = useAuthStore((state) => state.status);
  const [requests, setRequests] = useState<ReturnType<typeof readLegacyRecovery>>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const refresh = () => {
      try {
        if (!session && authStatus === "unauthenticated") readLegacyRecovery("");
        setRequests(session && customerId ? readLegacyRecovery(customerId).filter((r) =>
          (!businessId || r.pointer.businessId === businessId) && (!packageId || r.pointer.packageId === packageId)) : []);
        setError(undefined);
      } catch (cause) { setRequests([]); setError(toUserMessage(cause)); }
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(LEGACY_RECOVERY_CHANGED, refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener(LEGACY_RECOVERY_CHANGED, refresh); };
  }, [session, customerId, businessId, packageId, authStatus]);
  if (!session || !customerId) return null;
  return <section aria-label="Legacy package recovery" className="w-full space-y-3">
    {error && <p role="alert">Saved package recovery data could not be read. Contact support before starting another package request.</p>}
    {requests.filter((r) => r.pointer.customerId === customerId).map((r) => <Request key={`${session}:${r.pointer.idempotencyKey}`}
      pointer={r.pointer} record={r.record} session={session} onResolved={onResolved} />)}
  </section>;
}
