import RequireCustomer from "@/components/auth/RequireCustomer";
import PackageConsentReview from "@/components/packages/PackageConsentReview";

export const dynamic = "force-dynamic";
export default async function PackageConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; packageId: string }>;
  searchParams: Promise<{ operation?: string }>;
}) {
  // Server-side UI gate; API independently enforces its own default-off gate.
  if (process.env.PACKAGE_CONSENT_UI_ENABLED !== "true")
    return (
      <main className="min-h-screen bg-[#FDFBF9] p-8 font-poppins">
        <h1>Package terms review is unavailable</h1>
      </main>
    );
  const { businessId, packageId } = await params;
  const { operation } = await searchParams;
  return (
    <RequireCustomer>
      <PackageConsentReview
        key={`${businessId}:${packageId}:${operation ?? "new"}`}
        businessId={businessId}
        packageId={packageId}
        initialOperationId={operation}
      />
    </RequireCustomer>
  );
}
