"use client";
import Link from "next/link";
import type { OwnedPackageView, PackageOffer, PackageSettlementView } from "@/lib/api/package-views";
import { useAuthStore } from "@/lib/auth/store";
import { usePackageView } from "@/lib/packages/view-hooks";
import { CancellationReview, OfferCard, OwnedPackageCard, PackageReadError, PackageUnavailable, SettlementCard } from "./FirstClassPackageViews";

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
  const query = usePackageView("owned");
  if (query.isPending) return <p role="status">Loading your multi-service packages…</p>;
  if (query.isError) return <PackageReadError error={query.error} />;
  const result = query.data as { packages: OwnedPackageView[]; hasMore: boolean } | undefined;
  return <section className="mb-6 w-full space-y-5" aria-label="Owned multi-service packages"><h2 className="font-manrope text-xl font-bold">Multi-service packages</h2>
    {result?.packages.length ? <div className="grid gap-5">{result.packages.map((pkg) => <OwnedPackageCard key={pkg.id} pkg={pkg} />)}</div>
      : <p className="rounded-xl border border-[#C6C6CB] bg-white p-6">You have no purchased first-class multi-service packages. Checkout is currently unavailable.</p>}
    {result?.hasMore && <p>Showing the latest 50 packages. Contact support for older records.</p>}</section>;
}
export function OwnedFirstClassDetail({ id }: { id: string }) {
  const query = usePackageView("owned", undefined, id);
  if (query.isPending) return <p role="status">Loading package details…</p>;
  if (query.isError) return <PackageReadError error={query.error} />;
  const pkg = (query.data as { packages: OwnedPackageView[] } | undefined)?.packages[0];
  return pkg ? <OwnedPackageCard pkg={pkg} detail /> : <PackageReadError error={undefined} />;
}
export function FirstClassBookingContext({ progressId }: { progressId: string }) {
  return <section className="space-y-4"><Link className="text-[#240183] underline" href={`/customer/packages/${progressId}?kind=first-class`}>View multi-service Package sessions and balances</Link>
    <PackageUnavailable /><p className="text-sm">Rescheduling retains the same Booking and professional and does not consume a second package credit. Valid new times require server admission.</p><CancellationReview /></section>;
}
export function ManagementPackageSettlement({ businessId, bookingId }: { businessId: string; bookingId: string }) {
  const role = useAuthStore((s) => s.user?.role);
  const query = usePackageView("settlement", businessId, bookingId);
  if (role !== "BUSINESS_OWNER" && role !== "SUPERVISOR") return <p role="status">Package settlement is restricted to the current Owner or Supervisor.</p>;
  if (query.isPending) return <p role="status">Loading package settlement…</p>;
  if (query.isError) return <PackageReadError error={query.error} />;
  return query.data ? <SettlementCard view={query.data as PackageSettlementView} /> : null;
}
