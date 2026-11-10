"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RequireCustomer from "@/components/auth/RequireCustomer";
import PackageAppointmentHistory from "@/components/packages/PackageAppointmentHistory";
import { useAuthStore } from "@/lib/auth/store";
import { formatBookingMoney } from "@/lib/bookings/format";
import { usePackageDetailQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import { usePackageView } from "@/lib/packages/view-hooks";
import type { OwnedPackageView } from "@/lib/api/package-views";
import {
  isLikelyVoidEligible,
  PACKAGE_STATUS_PRESENTATION,
} from "@/lib/packages/presentation";
import PackageActionControls from "@/components/packages/PackageActionControls";
import LegacyPackageRecovery from "@/components/packages/LegacyPackageRecovery";
import RedeemSessionModal from "../RedeemSessionModal";
import { LegacyRedemptionConfirmation } from "@/components/packages/LegacyRedemptionConfirmation";
import { OwnedFirstClassDetail } from "@/components/packages/FirstClassPackageIntegration";
import BusinessInfoSidebar from "@/components/packages/BusinessInfoSidebar";

export default function PackageDetailPage() {
  return (
    <RequireCustomer>
      <Suspense fallback={<p role="status" className="p-8 text-center text-sm">Loading package details…</p>}>
        <PackageDetailRoute />
      </Suspense>
    </RequireCustomer>
  );
}

function PackageDetailRoute() {
  const params = useParams<{ packageProgressId: string }>();
  const search = useSearchParams();
  const isFirstClass = search.get("kind") === "first-class";

  return isFirstClass ? (
    <FirstClassPackageDetailView packageProgressId={params.packageProgressId} />
  ) : (
    <LegacyPackageDetailView packageProgressId={params.packageProgressId} />
  );
}

function FirstClassPackageDetailView({ packageProgressId }: { packageProgressId: string }) {
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const query = usePackageView("owned", undefined, packageProgressId);
  const pkg = (query.data as { packages: OwnedPackageView[] } | undefined)?.packages[0];

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-manrope">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(value) => {
          if (!value) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <div className="w-full lg:max-w-none lg:mx-0 lg:pl-[65px] px-4 md:px-8 pt-[22px] flex items-center gap-2 text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
        <Link href="/" className="hover:text-black">Home</Link>
        <span>&gt;</span>
        <Link href="/customer/packages" className="hover:text-black">My Packages</Link>
        <span>&gt;</span>
        <span className="text-[#111111] font-bold">Package Details</span>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] py-8 flex justify-center items-start">
        <div className="w-full max-w-[1140px] flex flex-col lg:flex-row items-start gap-8 pb-20 font-manrope break-words">
          {/* LEFT COLUMN: Business Information Sidebar */}
          <BusinessInfoSidebar businessId={pkg?.businessId} />

          {/* RIGHT COLUMN: First-Class Package Detail Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
            <nav aria-label="Breadcrumb" className="text-sm text-[#5F5E5A]">
              <Link
                href="/customer/packages"
                className="hover:text-black hover:underline font-medium"
              >
                ← Back to My Packages
              </Link>
            </nav>

            <OwnedFirstClassDetail id={packageProgressId} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function LegacyPackageDetailView({ packageProgressId }: { packageProgressId: string }) {
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [isScheduling, setIsScheduling] = useState(false);
  const [bookedSessionId, setBookedSessionId] = useState<string>();

  const detailQuery = usePackageDetailQuery(packageProgressId);
  const pkg = detailQuery.data;
  const voidPackageMutation = useVoidPackageMutation();

  const scheduledCount =
    pkg?.sessions.filter((session) => session.status === "SCHEDULED").length ?? 0;
  const isAwaitingBalance = pkg?.status === "AWAITING_BALANCE";
  const canSchedule =
    pkg?.status === "ACTIVE" &&
    pkg.remainingSessions > 0 &&
    Boolean(pkg.fulfilmentEntitlement);

  const handleRefund = () => {
    if (!pkg || !window.confirm("Request a refund for this unused package? This cannot be undone.")) {
      return;
    }
    voidPackageMutation.mutate(
      { businessId: pkg.businessId, packageProgressId: pkg.id },
      {
        onError: () => {
          window.alert(
            "This package could not be refunded. It may already have a used or scheduled session. Please contact the business.",
          );
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-manrope">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(value) => {
          if (!value) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <div className="w-full lg:max-w-none lg:mx-0 lg:pl-[65px] px-4 md:px-8 pt-[22px] flex items-center gap-2 text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
        <Link href="/" className="hover:text-black">Home</Link>
        <span>&gt;</span>
        <Link href="/customer/packages" className="hover:text-black">My Packages</Link>
        <span>&gt;</span>
        <span className="text-[#111111] font-bold">Package Details</span>
      </div>

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] py-8 flex justify-center items-start">
        <div className="w-full max-w-[1140px] flex flex-col lg:flex-row items-start gap-8 pb-20 font-manrope break-words">
          {/* LEFT COLUMN: Business Information Sidebar */}
          <BusinessInfoSidebar businessId={pkg?.businessId} />

          {/* RIGHT COLUMN: Legacy Package Detail Content */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
            <nav aria-label="Breadcrumb" className="text-sm text-[#5F5E5A]">
              <Link
                href="/customer/packages"
                className="hover:text-black hover:underline font-medium"
              >
                ← Back to My Packages
              </Link>
            </nav>

            {pkg ? <LegacyPackageRecovery businessId={pkg.businessId} packageId={packageProgressId} /> : null}

            {detailQuery.isLoading ? (
              <PackageDetailSkeleton />
            ) : detailQuery.isError || !pkg ? (
              <div className="rounded-2xl border border-[#E2E1E6] bg-white p-8 md:p-12 text-center shadow-sm">
                <h1 className="font-manrope text-2xl font-bold text-[#020305]">
                  Package unavailable
                </h1>
                <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">
                  This package could not be found, or it may not belong to your account.
                </p>
                <Link
                  href="/customer/packages"
                  className="mt-6 inline-flex rounded-xl bg-[#0D0D0D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
                >
                  View My Packages
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* 1. Header & Session Summary Card */}
                <section className="rounded-2xl border border-[#E2E1E6] bg-white p-6 shadow-sm flex flex-col gap-5">
                  <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#F1EFEC] text-[#45474B]">
                          Standard Package
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold border ${PACKAGE_STATUS_PRESENTATION[pkg.status].className}`}
                        >
                          {PACKAGE_STATUS_PRESENTATION[pkg.status].label}
                        </span>
                      </div>
                      <h1 className="mt-2 font-manrope text-2xl md:text-3xl font-bold text-[#020305] leading-tight">
                        {pkg.purchaseSnapshot.name}
                      </h1>
                      {pkg.purchaseSnapshot.packageServicesName ? (
                        <p className="mt-1 text-sm text-[#45474B] font-medium">
                          {pkg.purchaseSnapshot.packageServicesName}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:min-w-[320px]">
                      <SummaryStat
                        label={isAwaitingBalance ? "Remaining" : "Available"}
                        value={pkg.status === "VOIDED" ? 0 : pkg.remainingSessions}
                      />
                      <SummaryStat label="Scheduled" value={scheduledCount} />
                      <SummaryStat label="Completed" value={pkg.completedSessions} />
                    </div>
                  </div>

                  {/* Scheduling CTA & Warnings */}
                  <div className="border-t border-[#E2E1E6] pt-5">
                    {isAwaitingBalance ? (
                      <div className="rounded-xl bg-[#FFF8DF] border border-[#F5E6B3] p-4 text-sm leading-6 text-[#725B00]">
                        <p className="font-semibold">Scheduling locked</p>
                        <p className="mt-1">
                          {pkg.remainingSessions === 1
                            ? "1 session remains, but it can be scheduled only after the outstanding purchase balance is recorded as paid."
                            : `${pkg.remainingSessions} sessions remain, but they can be scheduled only after the outstanding purchase balance is recorded as paid.`}
                        </p>
                      </div>
                    ) : canSchedule ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB]">
                        <div>
                          <p className="font-semibold text-[#1C1B1C]">
                            {pkg.remainingSessions === 1
                              ? "1 session is ready to schedule"
                              : `${pkg.remainingSessions} sessions are ready to schedule`}
                          </p>
                          <p className="mt-0.5 text-xs text-[#5F5E5A]">
                            Choose the professional, date, and time for your next appointment.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsScheduling(true)}
                          className="w-full shrink-0 rounded-xl bg-[#0D0D0D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors sm:w-auto"
                        >
                          Schedule next session
                        </button>
                      </div>
                    ) : pkg.status === "ACTIVE" && !pkg.fulfilmentEntitlement ? (
                      <p className="rounded-xl bg-[#F5F4EE] p-4 text-sm leading-6 text-[#5F5E5A]">
                        This package&apos;s fulfilment details are unavailable. Please contact support.
                      </p>
                    ) : pkg.status === "DEPLETED" ? (
                      <p className="text-sm font-medium text-[#5F5E5A]">
                        All package sessions have been scheduled or used.
                      </p>
                    ) : pkg.status === "VOIDED" ? (
                      <p className="text-sm font-medium text-[#5F5E5A]">
                        This package has been cancelled and cannot be used for new appointments.
                      </p>
                    ) : null}
                  </div>
                </section>

                <PackageActionControls businessId={pkg.businessId} packageId={pkg.id} />

                {/* 2. Financial Summary Card */}
                <section className="grid gap-4 rounded-2xl border border-[#E2E1E6] bg-white p-6 shadow-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                      Base package price
                    </p>
                    <p className="mt-2 font-manrope text-xl font-bold text-[#020305]">
                      {formatBookingMoney(pkg.purchaseSnapshot.bundlePriceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                      Outstanding purchase balance
                    </p>
                    <p className="mt-2 font-semibold text-[#020305]">
                      {pkg.balanceSettled
                        ? "Settled"
                        : `${formatBookingMoney(pkg.outstandingBalanceCents)} due at venue`}
                    </p>
                    {!pkg.balanceSettled ? (
                      <p className="mt-1 text-xs leading-5 text-[#5F5E5A]">
                        Includes any applicable add-ons and travel charges from the original
                        package purchase, less any deposit paid online.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                      Sessions
                    </p>
                    <p className="mt-2 font-semibold text-[#020305]">
                      {pkg.totalSessions} total · {pkg.status === "VOIDED" ? 0 : pkg.remainingSessions}{" "}
                      {isAwaitingBalance ? "remaining" : "available"}
                    </p>
                  </div>
                </section>

                {/* 3. Session History Card */}
                <section className="rounded-2xl border border-[#E2E1E6] bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="font-manrope text-xl font-bold text-[#020305]">Session history</h2>
                    <p className="mt-1 text-sm text-[#5F5E5A]">
                      Every scheduled appointment remains visible, including cancelled attempts.
                    </p>
                  </div>

                  <PackageAppointmentHistory
                    sessions={pkg.sessions}
                    totalSessions={pkg.totalSessions}
                    customer
                    showCustomerActions={pkg.status !== "VOIDED"}
                  />
                </section>

                {/* 4. Package Refund Section */}
                {isLikelyVoidEligible(pkg) ? (
                  <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                    <h2 className="font-manrope text-lg font-bold text-[#020305]">Package refund</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5F5E5A]">
                      This is a package-level refund request. It is separate from cancelling one
                      scheduled session.
                    </p>
                    <button
                      type="button"
                      onClick={handleRefund}
                      disabled={voidPackageMutation.isPending}
                      className="mt-4 w-full rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-[#BA1A1A] hover:bg-red-50 disabled:opacity-50 transition-colors sm:w-auto"
                    >
                      {voidPackageMutation.isPending
                        ? "Requesting refund…"
                        : "Request refund for unused package"}
                    </button>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {isScheduling && pkg ? (
        <RedeemSessionModal
          key={pkg.id}
          businessId={pkg.businessId}
          packageProgressId={pkg.id}
          serviceId={pkg.serviceId}
          fulfilmentEntitlement={pkg.fulfilmentEntitlement!}
          packageName={pkg.purchaseSnapshot.packageServicesName ?? pkg.purchaseSnapshot.name}
          nextSessionIndex={pkg.totalSessions - pkg.remainingSessions + 1}
          totalSessions={pkg.totalSessions}
          onClose={() => setIsScheduling(false)}
          onBooked={(bookingId) => { setIsScheduling(false); setBookedSessionId(bookingId); }}
        />
      ) : null}
      {bookedSessionId && pkg ? (
        <LegacyRedemptionConfirmation
          bookingId={bookedSessionId}
          businessId={pkg.businessId}
          packageProgressId={pkg.id}
          onClose={() => setBookedSessionId(undefined)}
        />
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] px-2 py-3 text-center md:px-4">
      <p className="font-manrope text-xl font-bold text-[#020305]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#5F5E5A] sm:text-xs">{label}</p>
    </div>
  );
}

function PackageDetailSkeleton() {
  return (
    <div aria-label="Loading package details" className="flex animate-pulse flex-col gap-6">
      <div className="h-44 rounded-2xl border border-[#E2E1E6] bg-white" />
      <div className="h-32 rounded-2xl border border-[#E2E1E6] bg-white" />
      <div className="h-72 rounded-2xl border border-[#E2E1E6] bg-white" />
    </div>
  );
}
