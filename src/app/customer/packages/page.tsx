"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/landing-page/SearchBar";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useMyPackagesQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import type { PackageProgress } from "@/lib/api/packages";
import { formatBookingMoney } from "@/lib/bookings/format";
import RedeemSessionModal from "./RedeemSessionModal";

const STATUS_BADGE: Record<PackageProgress["status"], { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#DFFDDF] text-[#176117]" },
  AWAITING_BALANCE: { label: "Balance due at venue", className: "bg-[#FFF3CD] text-[#8A6D0B]" },
  DEPLETED: { label: "Fully used", className: "bg-neutral-100 text-neutral-500" },
  VOIDED: { label: "Refunded", className: "bg-neutral-100 text-neutral-500" },
};

/** Client-side mirror of BookingLifecycleService.voidUnusedPackage's own eligibility rule
 * ("completely unused": no session ever COMPLETED/FORFEITED, and nothing left unresolved other
 * than the origin's own still-upcoming appointment) — a convenience hint for whether to show the
 * refund action at all. The server re-checks this authoritatively; a wrong guess here just
 * surfaces as an error toast, never an incorrect refund. */
const isLikelyVoidEligible = (pkg: PackageProgress): boolean =>
  pkg.status !== "VOIDED" &&
  !pkg.sessions.some((session) => session.status === "COMPLETED" || session.status === "FORFEITED");

export default function PackagesPage() {
  return (
    <RequireCustomer>
      <PackagesPageContent />
    </RequireCustomer>
  );
}

function PackagesPageContent() {
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const packagesQuery = useMyPackagesQuery();
  const packages = packagesQuery.data?.packages ?? [];
  const voidPackageMutation = useVoidPackageMutation();

  const [redeemingPackageId, setRedeemingPackageId] = useState<string | null>(null);
  const redeemingPackage = packages.find((p) => p.id === redeemingPackageId);

  const handleRequestRefund = (pkg: PackageProgress) => {
    if (!window.confirm("Refund and cancel this package? This cannot be undone.")) {
      return;
    }
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

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center">
        <div className="w-full flex justify-center mb-[72px]">
          <SearchBar onSearch={() => {}} />
        </div>

        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          <h1 className="font-manrope font-bold text-[30px] leading-[36px] tracking-[-0.75px] text-[#020305]">
            My Packages
          </h1>

          <div className="flex flex-col items-start gap-6 w-full">
            {packagesQuery.isLoading ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">Loading your packages…</p>
              </div>
            ) : packagesQuery.isError ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">Your packages could not be loaded right now.</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <p className="text-[#45474B] text-lg font-medium">You haven&apos;t purchased any packages yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="bg-white border border-[#C6C6CB] rounded-xl p-6 flex flex-col gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <h3 className="font-manrope font-bold text-lg text-[#020305]">
                          {pkg.purchaseSnapshot.name}
                        </h3>
                        {pkg.purchaseSnapshot.packageServicesName && (
                          <span className="text-sm text-[#45474B]">
                            {pkg.purchaseSnapshot.packageServicesName}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[pkg.status].className}`}
                      >
                        {STATUS_BADGE[pkg.status].label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#45474B]">Sessions remaining</span>
                      <span className="font-semibold text-[#020305]">
                        {pkg.remainingSessions} / {pkg.totalSessions}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#45474B]">Sessions completed</span>
                      <span className="font-semibold text-[#020305]">{pkg.completedSessions}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#45474B]">Package price</span>
                      <span className="font-semibold text-[#020305]">
                        {formatBookingMoney(pkg.purchaseSnapshot.bundlePriceCents)}
                      </span>
                    </div>

                    {!pkg.balanceSettled && pkg.status !== "VOIDED" && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#8A6D0B]">Balance due at venue</span>
                        <span className="font-semibold text-[#8A6D0B]">
                          {formatBookingMoney(pkg.outstandingBalanceCents)}
                        </span>
                      </div>
                    )}

                    {pkg.status === "AWAITING_BALANCE" && (
                      <p className="text-xs text-[#8A6D0B]">
                        Further sessions unlock once the business records your remaining balance
                        as paid at your first appointment.
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={pkg.status !== "ACTIVE"}
                      onClick={() => setRedeemingPackageId(pkg.id)}
                      className="mt-2 w-full py-2.5 rounded-lg bg-[#0D0D0D] hover:bg-black text-white text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pkg.status === "ACTIVE"
                        ? "Book a session"
                        : pkg.status === "AWAITING_BALANCE"
                          ? "Balance not yet settled"
                          : pkg.status === "VOIDED"
                            ? "Refunded"
                            : "No sessions remaining"}
                    </button>

                    {isLikelyVoidEligible(pkg) && (
                      <button
                        type="button"
                        disabled={voidPackageMutation.isPending}
                        onClick={() => handleRequestRefund(pkg)}
                        className="w-full py-2 rounded-lg border border-[#C6C6CB] text-[#45474B] text-sm font-medium cursor-pointer hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Request refund (unused package)
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {redeemingPackage && (
        <RedeemSessionModal
          businessId={redeemingPackage.businessId}
          packageProgressId={redeemingPackage.id}
          serviceId={redeemingPackage.serviceId}
          onClose={() => setRedeemingPackageId(null)}
          onBooked={() => setRedeemingPackageId(null)}
        />
      )}
    </div>
  );
}
