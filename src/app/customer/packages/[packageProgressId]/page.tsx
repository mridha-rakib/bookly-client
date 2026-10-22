"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RequireCustomer from "@/components/auth/RequireCustomer";
import SearchBar from "@/components/landing-page/SearchBar";
import PackageAppointmentHistory from "@/components/packages/PackageAppointmentHistory";
import { useAuthStore } from "@/lib/auth/store";
import {
  formatBookingMoney,
} from "@/lib/bookings/format";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { usePackageDetailQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import {
  isLikelyVoidEligible,
  PACKAGE_STATUS_PRESENTATION,
} from "@/lib/packages/presentation";
import PackageActionControls from "@/components/packages/PackageActionControls";
import RedeemSessionModal from "../RedeemSessionModal";


export default function PackageDetailPage() {
  return (
    <RequireCustomer>
      <PackageDetailContent />
    </RequireCustomer>
  );
}

function PackageDetailContent() {
  const params = useParams<{ packageProgressId: string }>();
  const packageProgressId = params.packageProgressId;
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [isScheduling, setIsScheduling] = useState(false);

  const detailQuery = usePackageDetailQuery(packageProgressId);
  const pkg = detailQuery.data;
  const catalogQuery = useBusinessCatalogQuery(pkg?.businessId);
  const voidPackageMutation = useVoidPackageMutation();

  const scheduledCount =
    pkg?.sessions.filter((session) => session.status === "SCHEDULED").length ?? 0;
  const business = catalogQuery.data?.business;
  const isAwaitingBalance = pkg?.status === "AWAITING_BALANCE";
  const canSchedule =
    pkg?.status === "ACTIVE" &&
    pkg.remainingSessions > 0 &&
    Boolean(pkg.fulfilmentEntitlement) &&
    Boolean(business);

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
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(value) => {
          if (!value) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col items-center">
        <div className="w-full flex justify-center mb-10 md:mb-[56px]">
          <SearchBar onSearch={() => {}} />
        </div>

        <div className="max-w-[1005px] w-full pb-20 font-poppins">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-[#5F5E5A]">
            <Link
              href="/customer/bookings?view=packages"
              className="hover:text-black hover:underline"
            >
              ← Back to Packages in My Bookings
            </Link>
          </nav>

          {detailQuery.isLoading ? (
            <PackageDetailSkeleton />
          ) : detailQuery.isError || !pkg ? (
            <div className="rounded-xl border border-[#C6C6CB] bg-white p-8 md:p-12 text-center">
              <h1 className="font-manrope text-2xl font-bold text-[#020305]">
                Package unavailable
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">
                This package could not be found, or it may not belong to your account.
              </p>
              <Link
                href="/customer/bookings?view=packages"
                className="mt-6 inline-flex rounded-lg bg-[#0D0D0D] px-5 py-2.5 text-sm font-semibold text-white"
              >
                View packages in My Bookings
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <section className="rounded-2xl border border-[#C6C6CB] bg-white p-5 md:p-7">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="font-manrope text-[28px] font-bold leading-9 text-[#020305] md:text-[34px]">
                        {pkg.purchaseSnapshot.name}
                      </h1>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${PACKAGE_STATUS_PRESENTATION[pkg.status].className}`}
                      >
                        {PACKAGE_STATUS_PRESENTATION[pkg.status].label}
                      </span>
                    </div>
                    {pkg.purchaseSnapshot.packageServicesName ? (
                      <p className="mt-1 text-sm text-[#45474B]">
                        {pkg.purchaseSnapshot.packageServicesName}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-[#5F5E5A]">
                      {business?.name ?? (catalogQuery.isLoading ? "Loading business…" : "Business")}
                    </p>
                  </div>

                  <div className="grid w-full grid-cols-1 gap-2 min-[375px]:grid-cols-3 md:w-auto md:min-w-[360px]">
                    <SummaryStat
                      label={isAwaitingBalance ? "Remaining" : "Available"}
                      value={pkg.status === "VOIDED" ? 0 : pkg.remainingSessions}
                    />
                    <SummaryStat label="Scheduled" value={scheduledCount} />
                    <SummaryStat label="Completed" value={pkg.completedSessions} />
                  </div>
                </div>

                <div className="mt-5 border-t border-[#E2E0DF] pt-5">
                  {isAwaitingBalance ? (
                    <div className="rounded-xl bg-[#FFF8DF] p-4 text-sm leading-6 text-[#725B00]">
                      <p className="font-semibold">Scheduling locked</p>
                      <p className="mt-1">
                        {pkg.remainingSessions === 1
                          ? "1 session remains, but it can be scheduled only after the outstanding purchase balance is recorded as paid."
                          : `${pkg.remainingSessions} sessions remain, but they can be scheduled only after the outstanding purchase balance is recorded as paid.`}
                      </p>
                    </div>
                  ) : canSchedule ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-[#1C1B1C]">
                          {pkg.remainingSessions === 1
                            ? "1 session is ready to schedule"
                            : `${pkg.remainingSessions} sessions are ready to schedule`}
                        </p>
                        <p className="mt-1 text-sm text-[#5F5E5A]">
                          Choose the professional, date, and time for your next appointment.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsScheduling(true)}
                        className="w-full shrink-0 rounded-lg bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white hover:bg-black sm:w-auto"
                      >
                        Schedule next session
                      </button>
                    </div>
                  ) : pkg.status === "ACTIVE" && !pkg.fulfilmentEntitlement ? (
                    <p className="rounded-xl bg-[#F5F4EE] p-4 text-sm leading-6 text-[#5F5E5A]">
                      This package&apos;s fulfilment details are unavailable. Please contact support.
                    </p>
                  ) : pkg.status === "ACTIVE" && catalogQuery.isLoading ? (
                    <p className="text-sm text-[#5F5E5A]">Checking scheduling availability…</p>
                  ) : pkg.status === "ACTIVE" && catalogQuery.isError ? (
                    <p className="rounded-xl bg-[#F5F4EE] p-4 text-sm text-[#5F5E5A]">
                      Online scheduling is temporarily unavailable. Please try again later.
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
              <section className="grid gap-4 rounded-2xl border border-[#C6C6CB] bg-white p-5 md:grid-cols-3 md:p-7">
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

              <section className="rounded-2xl border border-[#C6C6CB] bg-white p-5 md:p-7">
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

              {isLikelyVoidEligible(pkg) ? (
                <section className="rounded-2xl border border-red-100 bg-white p-5 md:p-7">
                  <h2 className="font-manrope text-lg font-bold text-[#020305]">Package refund</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5F5E5A]">
                    This is a package-level refund request. It is separate from cancelling one
                    scheduled session.
                  </p>
                  <button
                    type="button"
                    onClick={handleRefund}
                    disabled={voidPackageMutation.isPending}
                    className="mt-4 w-full rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-[#BA1A1A] hover:bg-red-50 disabled:opacity-50 sm:w-auto"
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
          onBooked={() => setIsScheduling(false)}
        />
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F5F4EE] px-2 py-3 text-center md:px-4">
      <p className="font-manrope text-xl font-bold text-[#020305]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[#5F5E5A] sm:text-xs">{label}</p>
    </div>
  );
}


function PackageDetailSkeleton() {
  return (
    <div aria-label="Loading package details" className="flex animate-pulse flex-col gap-6">
      <div className="h-44 rounded-2xl border border-[#E2E0DF] bg-white" />
      <div className="h-32 rounded-2xl border border-[#E2E0DF] bg-white" />
      <div className="h-72 rounded-2xl border border-[#E2E0DF] bg-white" />
    </div>
  );
}
