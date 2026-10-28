"use client";
import type { PackageOffer } from "@/lib/api/package-views";
import { usePackageView } from "@/lib/packages/view-hooks";
import { PackageCatalogue } from "./FirstClassPackageIntegration";
import PackageConsentReview from "./PackageConsentReview";

/** Read-only production entry until the server explicitly reports checkout available.
 * No URL selector or browser flag can activate the API or certification boundary. */
export function PackagePurchaseEntry({ businessId, packageId, operationId }: { businessId: string; packageId: string; operationId?: string }) {
  const query = usePackageView("catalogue", businessId, packageId);
  const offer = (query.data as { packages: PackageOffer[] } | undefined)?.packages.find((p) => p.id === packageId);
  if (offer?.checkoutAvailable === true) return <PackageConsentReview businessId={businessId} packageId={packageId} initialOperationId={operationId} />;
  return <PackageCatalogue businessId={businessId} packageId={packageId} />;
}
