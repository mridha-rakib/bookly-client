import RequireCustomer from "@/components/auth/RequireCustomer";
import { PackageCatalogue } from "@/components/packages/FirstClassPackageIntegration";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function PackageConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; packageId: string }>;
  searchParams: Promise<{ operation?: string }>;
}) {
  const { businessId, packageId } = await params;
  await searchParams;
  return (
    <RequireCustomer>
      <main className="min-h-screen bg-[#FDFBF9] px-4 py-8 sm:px-8"><div className="mx-auto max-w-[1005px] space-y-6">
        <Link className="text-[#240183] underline" href={`/venue?id=${encodeURIComponent(businessId)}`}>← Back to venue</Link>
        <PackageCatalogue businessId={businessId} packageId={packageId} />
      </div></main>
    </RequireCustomer>
  );
}
