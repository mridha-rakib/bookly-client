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
  if (query.isError) return <PackageReadError error={query.error} />;
  const packages = (query.data as { packages: PackageOffer[] } | undefined)?.packages ?? [];
  return <section className="space-y-5" aria-label="Multi-service packages"><h2 className="font-manrope text-xl font-bold">Multi-service packages</h2>
    <p className="text-sm text-[#5F5E5A]">First-class Package Definitions, separate from historical Package Deals.</p>
    {packages.length ? <div className={packageId ? "space-y-5" : "grid gap-5 md:grid-cols-2"}>{packages.map((offer) => <OfferCard key={offer.id} offer={offer} detail={Boolean(packageId)} />)}</div>
      : <p className="rounded-xl border border-[#C6C6CB] bg-white p-6">No eligible published multi-service packages are available.</p>}</section>;
}
export function OwnedFirstClassPackages() {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const query = usePackageView("owned", undefined, undefined, cursors[cursors.length - 1]);
  const newer = cursors.length > 1 && <button type="button" onClick={() => setCursors((current) => current.slice(0, -1))}>Newer packages</button>;
  if (query.isPending) return <>{newer}<p role="status">Loading your multi-service packages…</p></>;
  if (query.isError) return <>{newer}<PackageReadError error={query.error} /></>;
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
  if (query.isError) return <PackageReadError error={query.error} />;
  return pkg ? <><OwnedPackageCard pkg={pkg} detail sessionReview={false} />
    {pkg.purchaseCompletion === "VERIFIED" && <><FirstClassLifecycleControls key={pkg.id} pkg={pkg} />
      <FirstClassSessionActions businessId={pkg.businessId} progressId={pkg.id} enabled={pkg.actionsAvailable} />
      {pkg.sessions.filter((s) => s.booking?.status === "UPCOMING").map((s) => <FirstClassSessionActions key={s.bookingId} businessId={pkg.businessId} progressId={pkg.id} bookingId={s.bookingId} enabled={pkg.actionsAvailable} />)}
      {/* A retained action for a Booking that left the upcoming list is checked once, read-only; a
          proven COMMITTED retires it, an unresolved one stays visible with its identical retry. */}
      {retained.map((bookingId) => <FirstClassSessionActions key={`retained:${bookingId}`} businessId={pkg.businessId} progressId={pkg.id} bookingId={bookingId} enabled={pkg.actionsAvailable} onRetired={() => retire(bookingId)} />)}</>}
    </> : <PackageReadError error={undefined} />;
}
export function FirstClassBookingContext({ progressId }: { progressId: string }) {
  const query = usePackageView("owned", undefined, progressId);
  const pkg = (query.data as { packages: OwnedPackageView[] } | undefined)?.packages[0];
  return <section className="space-y-4"><Link className="text-[#240183] underline" href={`/customer/packages/${progressId}?kind=first-class`}>View multi-service Package sessions and balances</Link>
    {query.isError ? <PackageReadError error={query.error} /> : !pkg?.actionsAvailable && <PackageUnavailable />}
    <p className="text-sm">Rescheduling retains the same Booking and professional and does not consume a second package credit. Valid new times require server admission. Use the Package detail to manage this appointment.</p>{!pkg?.actionsAvailable && <CancellationReview />}</section>;
}
export function ManagementPackageSettlement({ businessId, bookingId }: { businessId: string; bookingId: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const query = usePackageView("settlement", businessId, bookingId);
  if (role !== "BUSINESS_OWNER" && role !== "SUPERVISOR") return <p role="status">Package settlement is restricted to the current Owner or Supervisor.</p>;
  if (query.isPending) return <p role="status">Loading package settlement…</p>;
  if (query.isError) return <PackageReadError error={query.error} />;
  const view = query.data as PackageSettlementView | undefined;
  return view ? <><SettlementCard view={view} />{view.packageProgressId && <FirstClassSessionActions
    businessId={businessId} progressId={view.packageProgressId} bookingId={bookingId}
    enabled={view.actionsAvailable && view.purchaseCompletion === "VERIFIED"} management />}</> : null;
}
