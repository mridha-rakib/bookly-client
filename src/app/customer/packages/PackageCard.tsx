"use client";

import Link from "next/link";

import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";
import type { PackageProgress } from "@/lib/api/packages";
import { formatBookingMoney } from "@/lib/bookings/format";
import {
  isLikelyVoidEligible,
  PACKAGE_STATUS_PRESENTATION,
} from "@/lib/packages/presentation";

interface PackageCardProps {
  pkg: PackageProgress;
  isRefundPending: boolean;
  onRequestRefund: (pkg: PackageProgress) => void;
}

export default function PackageCard({
  pkg,
  isRefundPending,
  onRequestRefund,
}: PackageCardProps) {
  const catalogQuery = useBusinessCatalogQuery(pkg.businessId);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-[#C6C6CB] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0">
          <h3 className="font-manrope text-lg font-bold text-[#020305]">
            {pkg.purchaseSnapshot.name}
          </h3>
          {pkg.purchaseSnapshot.packageServicesName ? (
            <p className="mt-0.5 text-sm text-[#45474B]">
              {pkg.purchaseSnapshot.packageServicesName}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-[#5F5E5A]">
            {catalogQuery.data?.business.name ??
              (catalogQuery.isLoading ? "Loading business…" : "Business")}
          </p>
        </div>
        <span
          className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${PACKAGE_STATUS_PRESENTATION[pkg.status].className}`}
        >
          {PACKAGE_STATUS_PRESENTATION[pkg.status].label}
        </span>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#45474B]">Sessions remaining</dt>
          <dd className="font-semibold text-[#020305]">
            {pkg.remainingSessions} / {pkg.totalSessions}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#45474B]">Sessions completed</dt>
          <dd className="font-semibold text-[#020305]">{pkg.completedSessions}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#45474B]">Base package price</dt>
          <dd className="font-semibold text-[#020305]">
            {formatBookingMoney(pkg.purchaseSnapshot.bundlePriceCents)}
          </dd>
        </div>
        {!pkg.balanceSettled && pkg.status !== "VOIDED" ? (
          <div className="flex items-start justify-between gap-4 text-[#8A6D0B]">
            <dt>Outstanding purchase balance</dt>
            <dd className="shrink-0 font-semibold">
              {formatBookingMoney(pkg.outstandingBalanceCents)}
            </dd>
          </div>
        ) : null}
      </dl>

      {pkg.status === "AWAITING_BALANCE" ? (
        <p className="rounded-lg bg-[#FFF8DF] p-3 text-xs leading-5 text-[#725B00]">
          Scheduling is locked until the business records the outstanding purchase balance as
          paid.
        </p>
      ) : null}

      <Link
        href={`/customer/packages/${pkg.id}`}
        className="mt-auto w-full rounded-lg bg-[#0D0D0D] py-2.5 text-center text-sm font-semibold text-white hover:bg-black"
      >
        View package
      </Link>

      {isLikelyVoidEligible(pkg) ? (
        <button
          type="button"
          disabled={isRefundPending}
          onClick={() => onRequestRefund(pkg)}
          className="w-full cursor-pointer rounded-lg border border-[#C6C6CB] py-2 text-sm font-medium text-[#45474B] hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Request refund (unused package)
        </button>
      ) : null}
    </article>
  );
}
