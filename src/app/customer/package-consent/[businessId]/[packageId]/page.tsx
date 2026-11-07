import RequireCustomer from "@/components/auth/RequireCustomer";
import { PackagePurchaseEntry } from "@/components/packages/PackagePurchaseEntry";

export const dynamic = "force-dynamic";
export default async function PackageConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; packageId: string }>;
  searchParams: Promise<{ operation?: string }>;
}) {
  const { businessId, packageId } = await params;
  const { operation } = await searchParams;
  return (
    <RequireCustomer>
      <main className="min-h-screen bg-[#FCFAF9]"><PackagePurchaseEntry businessId={businessId} packageId={packageId} operationId={operation} /></main>
    </RequireCustomer>
  );
}
