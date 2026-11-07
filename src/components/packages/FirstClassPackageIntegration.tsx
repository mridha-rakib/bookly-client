"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { OwnedPackageView, PackageOffer, PackageSettlementView } from "@/lib/api/package-views";
import { useAuthStore } from "@/lib/auth/store";
import { usePackageView } from "@/lib/packages/view-hooks";
import { CancellationReview, OfferCard, OwnedPackageCard, PackageReadError, PackageUnavailable, SettlementCard } from "./FirstClassPackageViews";
import { FirstClassLifecycleControls, FirstClassSessionActions, sessionActionStorageKey } from "./FirstClassLifecycleControls";

export function PackageCatalogue({ businessId, packageId }: { businessId: string; packageId?: string }) {
  const user = useAuthStore((s) => s.user);
  const query = usePackageView("catalogue", businessId, packageId);
  if (user?.role !== "CUSTOMER") return <section className="rounded-xl border border-[#C6C6CB] bg-white p-5"><h2 className="font-manrope text-xl font-bold">Multi-service packages</h2><p className="mt-3 text-sm"><Link className="text-[#240183] underline" href="/customer">Sign in as a Customer to view published package definitions.</Link></p></section>;
  if (query.isPending) return <p role="status">Loading multi-service packages…</p>;
  if (query.isError) return <PackageReadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  const packages = (query.data as { packages: PackageOffer[] } | undefined)?.packages ?? [];
  return <section className="space-y-5" aria-label="Multi-service packages"><h2 className="font-manrope text-xl font-bold">Multi-service packages</h2>
    <p className="text-sm text-[#5F5E5A]">Explore included services, session quantities and package validity.</p>
    {packages.length ? <div className={packageId ? "space-y-5" : "grid gap-5 md:grid-cols-2"}>{packages.map((offer) => <OfferCard key={offer.id} offer={offer} detail={Boolean(packageId)} />)}</div>
      : <p className="rounded-xl border border-[#C6C6CB] bg-white p-6">No eligible published multi-service packages are available.</p>}</section>;
}
export function OwnedFirstClassPackages() {
  const actor = useAuthStore((s) => `${s.user?.id}:${s.cacheEpoch}`);
  return <OwnedPackagePages key={actor} />;
}
function OwnedPackagePages() {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const query = usePackageView("owned", undefined, undefined, cursors[cursors.length - 1]);
  const newer = cursors.length > 1 && <button type="button" onClick={() => setCursors((current) => current.slice(0, -1))}>Newer packages</button>;
  if (query.isPending) return <>{newer}<p role="status">Loading your multi-service packages…</p></>;
  if (query.isError) return <>{newer}<PackageReadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /></>;
  const result = query.data as { packages: OwnedPackageView[]; hasMore: boolean; nextCursor?: string | null } | undefined;
  return <section className="mb-6 w-full space-y-5" aria-label="Owned multi-service packages"><h2 className="font-manrope text-xl font-bold">Multi-service packages</h2>
    {result?.packages.length ? <div className="grid gap-5">{result.packages.map((pkg) => <OwnedPackageCard key={pkg.id} pkg={pkg} />)}</div>
      : <p className="rounded-xl border border-[#C6C6CB] bg-white p-6">{cursors.length > 1 ? "No older packages on this page." : "You have no purchased first-class multi-service packages."}</p>}
    <nav aria-label="Package history pages" className="flex gap-4">
      {newer}
      {result?.hasMore && result.nextCursor && <button type="button" onClick={() => setCursors((current) => [...current, result.nextCursor!])}>Older packages</button>}
    </nav></section>;
}
/** P4K-5: Customer actions saved for this Package whose Booking is no longer upcoming (for example
 * a cancellation whose response was lost). Reads only this user's exact per-Booking keys. */
function useRetainedSessionActions(pkg: OwnedPackageView | undefined, userId: string | undefined) {
  const [retained, setRetained] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize retained browser-storage actions when the authenticated Package changes.
    if (!pkg || !userId) { setRetained([]); return; }
    setRetained(pkg.sessions.filter((s) => s.booking?.status !== "UPCOMING").map((s) => s.bookingId).filter((bookingId) => {
      try { return sessionStorage.getItem(sessionActionStorageKey(userId, pkg.businessId, pkg.id, bookingId, false)) !== null; }
      catch { return false; }
    }));
  }, [pkg, userId]);
  return [retained, (bookingId: string) => setRetained((current) => current.filter((id) => id !== bookingId))] as const;
}
export function OwnedFirstClassDetail({ id }: { id: string }) {
  const query = usePackageView("owned", undefined, id);
  const userId = useAuthStore((s) => s.user?.id);
  const pkg = (query.data as { packages: OwnedPackageView[] } | undefined)?.packages[0];
  const [retained, retire] = useRetainedSessionActions(query.isSuccess ? pkg : undefined, userId);
  if (query.isPending) return <p role="status">Loading package details…</p>;
  if (query.isError) return <PackageReadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  return pkg ? <><OwnedPackageCard pkg={pkg} detail sessionReview={false} />
    {pkg.purchaseCompletion === "VERIFIED" && <><FirstClassLifecycleControls key={pkg.id} pkg={pkg} />
      <FirstClassSessionActions businessId={pkg.businessId} progressId={pkg.id} enabled={pkg.actionsAvailable} />
      {pkg.sessions.filter((s) => s.booking?.status === "UPCOMING").map((s) => <FirstClassSessionActions key={s.bookingId} businessId={pkg.businessId} progressId={pkg.id} bookingId={s.bookingId} bookingStatus={s.booking?.status}
        appointmentLabel={`${pkg.items.find((item) => item.id === s.itemId)?.name ?? "Package appointment"} · ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: s.booking!.timezone }).format(new Date(s.booking!.startAt))} (${s.booking!.timezone})`} enabled={pkg.actionsAvailable} />)}
      {/* A retained action for a Booking that left the upcoming list is checked once, read-only; a
          proven COMMITTED retires it, an unresolved one stays visible with its identical retry. */}
      {retained.map((bookingId) => <FirstClassSessionActions key={`retained:${bookingId}`} businessId={pkg.businessId} progressId={pkg.id} bookingId={bookingId} enabled={pkg.actionsAvailable} onRetired={() => retire(bookingId)} />)}</>}
    </> : <PackageReadError error={undefined} />;
}
export function FirstClassBookingContext({ progressId, currentBookingId }: { progressId: string; currentBookingId?: string }) {
  const query = usePackageView("owned", undefined, progressId);
  const pkg = (query.data as { packages: OwnedPackageView[] } | undefined)?.packages[0];
  const initialAppointments = pkg?.purchaseCompletion === "VERIFIED" ? pkg.sessions.filter((session) => session.booking?.role === "PURCHASE") : [];
  return <section className="space-y-4"><Link className="text-[#240183] underline" href={`/customer/packages/${progressId}?kind=first-class`}>View multi-service Package sessions and balances</Link>
    {pkg && <p className="font-semibold">Package: {pkg.name}</p>}
    {initialAppointments.length > 1 && <nav aria-label="Initial Package appointments" className="space-y-2 rounded-xl bg-[#F5F4EE] p-4 text-sm"><p>This Package has {initialAppointments.length} initial appointments.</p>
      <ul className="space-y-2">{initialAppointments.map((session, index) => <li key={session.bookingId}><Link className="text-[#240183] underline" aria-current={session.bookingId === currentBookingId ? "page" : undefined} href={`/customer/bookings/view?id=${encodeURIComponent(session.bookingId)}`}>Initial appointment {index + 1}: {pkg!.items.find((item) => item.id === session.itemId)?.name ?? "Package session"} · {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: session.booking!.timezone }).format(new Date(session.booking!.startAt))} ({session.booking!.timezone})</Link></li>)}</ul></nav>}
    {query.isPending ? <p role="status">Loading Package booking information…</p> : query.isError ? <PackageReadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : !pkg?.actionsAvailable && <PackageUnavailable />}
    <p className="text-sm">Rescheduling retains the same Booking and professional and does not consume a second package credit. Valid new times require server admission. Use the Package detail to manage this appointment.</p>{query.isSuccess && !pkg?.actionsAvailable && <CancellationReview />}</section>;
}
export function ManagementPackageSettlement({ businessId, bookingId }: { businessId: string; bookingId: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const query = usePackageView("settlement", businessId, bookingId);
  if (role !== "BUSINESS_OWNER" && role !== "SUPERVISOR") return <p role="status">Package settlement is restricted to the current Owner or Supervisor.</p>;
  if (query.isPending) return <p role="status">Loading package settlement…</p>;
  if (query.isError) return <PackageReadError error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  const view = query.data as PackageSettlementView | undefined;
  return view ? <><SettlementCard view={view} />{view.packageProgressId && <FirstClassSessionActions
    businessId={businessId} progressId={view.packageProgressId} bookingId={bookingId}
    bookingStatus={view.session?.booking?.status}
    outstandingBalanceCents={view.session?.booking?.outstandingBalanceCents}
    enabled={view.actionsAvailable && view.purchaseCompletion === "VERIFIED"} management />}</> : null;
}
