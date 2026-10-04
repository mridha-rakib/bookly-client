"use client";

import type { PackageProgress } from "@/lib/api/packages";
import { useMyPackagesQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import PackageCard from "./PackageCard";

export default function CustomerPackagesList() {
  const packagesQuery = useMyPackagesQuery();
  const packages = packagesQuery.data?.packages ?? [];
  const voidPackageMutation = useVoidPackageMutation();

  const handleRequestRefund = (pkg: PackageProgress) => {
    if (!window.confirm("Refund and cancel this package? This cannot be undone.")) return;

    voidPackageMutation.mutate(
      { businessId: pkg.businessId, packageProgressId: pkg.id },
      {
        onError: () => {
          window.alert(
            "This package could not be refunded — it may already have a used or scheduled session. Please contact the business.",
          );
        },
      },
    );
  };

  if (packagesQuery.isLoading) {
    return <PackageListMessage>Loading your packages…</PackageListMessage>;
  }

  if (packagesQuery.isError) {
    return <PackageListMessage>Your packages could not be loaded right now.</PackageListMessage>;
  }

  if (packages.length === 0) {
    return <PackageListMessage>You haven&apos;t purchased any packages yet.</PackageListMessage>;
  }

  return (
    <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          isRefundPending={voidPackageMutation.isPending}
          onRequestRefund={handleRequestRefund}
        />
      ))}
    </div>
  );
}

function PackageListMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-[#C6C6CB] bg-white py-20 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <p className="text-lg font-medium text-[#45474B]">{children}</p>
    </div>
  );
}
