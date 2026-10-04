"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import RequireCustomer from "@/components/auth/RequireCustomer";
import SearchBar from "@/components/landing-page/SearchBar";
import type { PackageProgressSession } from "@/lib/api/packages";
import { useAuthStore } from "@/lib/auth/store";
import {
  formatBookingDate,
  formatBookingMoney,
  formatBookingTimeRange,
} from "@/lib/bookings/format";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import { usePackageDetailQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import {
  isLikelyVoidEligible,
  PACKAGE_SESSION_STATUS_PRESENTATION,
  PACKAGE_STATUS_PRESENTATION,
} from "@/lib/packages/presentation";
import RedeemSessionModal from "../RedeemSessionModal";

const attemptsBySessionIndex = (sessions: PackageProgressSession[]): Map<number, number> => {
  const counts = new Map<number, number>();
  for (const session of sessions) {
    counts.set(session.sessionIndex, (counts.get(session.sessionIndex) ?? 0) + 1);
  }
  return counts;
};

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

  const attemptCounts = useMemo(
    () => attemptsBySessionIndex(pkg?.sessions ?? []),
    [pkg?.sessions],
  );
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
            <Link href="/customer/packages" className="hover:text-black hover:underline">
              ← Back to My Packages
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
                href="/customer/packages"
                className="mt-6 inline-flex rounded-lg bg-[#0D0D0D] px-5 py-2.5 text-sm font-semibold text-white"
              >
                View My Packages
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

                  <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:min-w-[360px]">
                    <SummaryStat
                      label={isAwaitingBalance ? "Remaining" : "Available"}
                      value={pkg.remainingSessions}
                    />
                    <SummaryStat label="Scheduled" value={scheduledCount} />
                    <SummaryStat label="Completed" value={pkg.completedSessions} />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 rounded-2xl border border-[#C6C6CB] bg-white p-5 md:grid-cols-3 md:p-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                    Package price
                  </p>
                  <p className="mt-2 font-manrope text-xl font-bold text-[#020305]">
                    {formatBookingMoney(pkg.purchaseSnapshot.bundlePriceCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                    Package balance
                  </p>
                  <p className="mt-2 font-semibold text-[#020305]">
                    {pkg.balanceSettled
                      ? "Settled"
                      : `${formatBookingMoney(pkg.outstandingBalanceCents)} due at venue`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                    Sessions
                  </p>
                  <p className="mt-2 font-semibold text-[#020305]">
                    {pkg.totalSessions} total · {pkg.remainingSessions}{" "}
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

                {pkg.sessions.length === 0 ? (
                  <p className="rounded-xl bg-[#F5F4EE] p-5 text-sm text-[#5F5E5A]">
                    No session appointments are available to show yet.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {pkg.sessions.map((session, index) => {
                      const repeatedAttempts = attemptCounts.get(session.sessionIndex) ?? 1;
                      const attemptNumber =
                        pkg.sessions
                          .slice(0, index + 1)
                          .filter((item) => item.sessionIndex === session.sessionIndex).length;
                      return (
                        <SessionHistoryItem
                          key={session.bookingId}
                          session={session}
                          totalSessions={pkg.totalSessions}
                          attemptNumber={attemptNumber}
                          repeatedAttempts={repeatedAttempts}
                        />
                      );
                    })}
                  </ol>
                )}
              </section>

              <section className="rounded-2xl border border-[#C6C6CB] bg-white p-5 md:p-7">
                <h2 className="font-manrope text-xl font-bold text-[#020305]">
                  {isAwaitingBalance ? "Remaining sessions" : "Available sessions"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#5F5E5A]">
                  {isAwaitingBalance
                    ? pkg.remainingSessions === 1
                      ? "1 session remains in this package."
                      : `${pkg.remainingSessions} sessions remain in this package.`
                    : pkg.remainingSessions === 1
                    ? "1 package session is available to schedule."
                    : `${pkg.remainingSessions} package sessions are available to schedule.`}
                </p>

                {isAwaitingBalance ? (
                  <div className="mt-4 rounded-xl bg-[#FFF8DF] p-4 text-sm leading-6 text-[#725B00]">
                    Further sessions can be scheduled after the remaining package balance is
                    recorded as paid.
                  </div>
                ) : pkg.status === "ACTIVE" && !pkg.fulfilmentEntitlement ? (
                  <div className="mt-4 rounded-xl bg-[#F5F4EE] p-4 text-sm leading-6 text-[#5F5E5A]">
                    This package&apos;s fulfilment details are unavailable. Please contact support.
                  </div>
                ) : pkg.status === "ACTIVE" && catalogQuery.isLoading ? (
                  <p className="mt-4 text-sm text-[#5F5E5A]">Checking scheduling availability…</p>
                ) : pkg.status === "ACTIVE" && catalogQuery.isError ? (
                  <p className="mt-4 rounded-xl bg-[#F5F4EE] p-4 text-sm text-[#5F5E5A]">
                    Online scheduling is temporarily unavailable. Please try again later.
                  </p>
                ) : pkg.status === "DEPLETED" ? (
                  <p className="mt-4 text-sm font-medium text-[#5F5E5A]">
                    All package sessions have been scheduled or used.
                  </p>
                ) : pkg.status === "VOIDED" ? (
                  <p className="mt-4 text-sm font-medium text-[#5F5E5A]">
                    This package was refunded and cannot be used for new appointments.
                  </p>
                ) : null}

                {canSchedule ? (
                  <button
                    type="button"
                    onClick={() => setIsScheduling(true)}
                    className="mt-5 w-full rounded-lg bg-[#0D0D0D] px-5 py-3 text-sm font-semibold text-white hover:bg-black sm:w-auto"
                  >
                    Schedule next session
                  </button>
                ) : null}
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

function SessionHistoryItem({
  session,
  totalSessions,
  attemptNumber,
  repeatedAttempts,
}: {
  session: PackageProgressSession;
  totalSessions: number;
  attemptNumber: number;
  repeatedAttempts: number;
}) {
  const presentation = PACKAGE_SESSION_STATUS_PRESENTATION[session.status];
  const isActionable = session.status === "SCHEDULED" && session.booking?.status === "UPCOMING";
  const bookingUrl = `/customer/bookings/view?id=${encodeURIComponent(session.bookingId)}`;

  return (
    <li className="rounded-xl border border-[#E2E0DF] p-4 md:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-manrope font-bold text-[#020305]">
              Session {session.sessionIndex} of {totalSessions}
            </h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
              {presentation.label}
            </span>
          </div>
          {repeatedAttempts > 1 ? (
            <p className="mt-1 text-xs font-medium text-[#725B00]">
              Appointment attempt {attemptNumber} of {repeatedAttempts}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-[#5F5E5A]">{presentation.description}</p>

          {session.booking ? (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                  Date and time
                </dt>
                <dd className="mt-1 font-medium text-[#1C1B1C]">
                  {formatBookingDate(
                    session.booking.schedule.startAt,
                    session.booking.schedule.timezone,
                  )}
                  {" · "}
                  {formatBookingTimeRange(session.booking.schedule)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[#888780]">
                  Professional
                </dt>
                <dd className="mt-1 font-medium text-[#1C1B1C]">
                  {session.booking.professional.displayName ?? "Professional"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#5F5E5A]">
              Booking details are unavailable.
            </p>
          )}
        </div>

        {session.booking ? (
          <div className="flex w-full flex-col gap-2 sm:w-[180px] sm:flex-none">
            <Link
              href={bookingUrl}
              className="rounded-lg border border-[#C6C6CB] px-4 py-2 text-center text-sm font-semibold text-[#020305] hover:bg-neutral-50"
            >
              View booking
            </Link>
            {isActionable ? (
              <>
                <Link
                  href={bookingUrl}
                  className="rounded-lg border border-[#C6C6CB] px-4 py-2 text-center text-sm font-semibold text-[#020305] hover:bg-neutral-50"
                >
                  Reschedule session
                </Link>
                <Link
                  href={bookingUrl}
                  className="rounded-lg border border-red-200 px-4 py-2 text-center text-sm font-semibold text-[#BA1A1A] hover:bg-red-50"
                >
                  Cancel session
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
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
