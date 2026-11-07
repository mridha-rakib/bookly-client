"use client";
import Link from "next/link";
import type { PackageOffer } from "@/lib/api/package-views";
import { usePackageView } from "@/lib/packages/view-hooks";
import { PackageCatalogue } from "./FirstClassPackageIntegration";
import PackageConsentReview from "./PackageConsentReview";

/** Read-only production entry until the server explicitly reports checkout available.
 * No URL selector or browser flag can activate the API or certification boundary. */
export function PackagePurchaseEntry({ businessId, packageId, operationId }: { businessId: string; packageId: string; operationId?: string }) {
  const query = usePackageView("catalogue", businessId, packageId);
  const offer = (query.data as { packages: PackageOffer[] } | undefined)?.packages.find((p) => p.id === packageId);
  // Recovery belongs to the retained operation, even if its definition was archived or the
  // current catalogue can no longer offer a fresh purchase. Every API gate still applies.
  if (operationId || offer?.checkoutAvailable === true) return <PackageConsentReview key={`${businessId}:${packageId}`} businessId={businessId} packageId={packageId} initialOperationId={operationId} offerSummary={offer} />;
  return <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-8 md:px-16">
    <Link className="text-[#240183] underline" href={`/venue?id=${encodeURIComponent(businessId)}`}>← Back to venue</Link>
    <PackageCatalogue businessId={businessId} packageId={packageId} />
  </div>;
}
