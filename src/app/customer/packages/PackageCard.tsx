"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

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
  const business = catalogQuery.data?.business;

  const scheduledSessions = pkg.sessions.filter((s) => s.status === "SCHEDULED").length;
  const completedSessions = pkg.completedSessions;
  const remainingSessions = pkg.status === "VOIDED" ? 0 : pkg.remainingSessions;
  const totalSessions = pkg.totalSessions;

  const completedPct = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  const scheduledPct = totalSessions > 0 ? (scheduledSessions / totalSessions) * 100 : 0;

  const isRefundPendingStatus = pkg.voidRefundSettlement?.status === "PENDING";
  const statusPresentation = isRefundPendingStatus
    ? { label: "Refund pending", className: "bg-[#FFF3CD] text-[#8A6D0B] border-amber-200" }
    : PACKAGE_STATUS_PRESENTATION[pkg.status] ?? {
        label: pkg.status,
        className: "bg-neutral-100 text-neutral-600 border-neutral-200",
      };

  return (
    <article
      data-testid={`legacy-package-${pkg.id}`}
      className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all flex flex-col p-6 gap-5 font-manrope h-full"
    >
      {/* Top Header: Badge, Status, Title, Provider */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#E5E7EB] text-[#111827]">
            Standard Package
          </span>
          <span
            className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-bold border ${statusPresentation.className}`}
          >
            {statusPresentation.label}
          </span>
        </div>

        <div>
          <h3 className="font-manrope font-bold text-lg sm:text-xl text-[#020305] leading-snug break-words">
            {pkg.purchaseSnapshot.name}
          </h3>
          {pkg.purchaseSnapshot.packageServicesName ? (
            <p className="mt-1 text-sm text-[#111827] font-semibold line-clamp-1">
              {pkg.purchaseSnapshot.packageServicesName}
            </p>
          ) : null}
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#020305]">
            <Image
              src="/Icons/salonNameIcon.svg"
              className="w-3.5 h-3.5 object-contain"
              alt="salon"
              width={14}
              height={14}
            />
            <span>
              {business?.name ?? (catalogQuery.isLoading ? "Loading business…" : "Business")}
            </span>
          </div>
        </div>
      </div>

      {/* Critical Status Warnings */}
      {pkg.status === "AWAITING_BALANCE" ? (
        <div
          role="status"
          className="rounded-xl bg-[#FFFBEB] border border-[#F59E0B] p-3 text-xs leading-5 text-[#92400E] font-medium"
        >
          <span className="font-bold block mb-0.5">Scheduling locked</span>
          Scheduling is locked until the business records the outstanding purchase balance as paid.
        </div>
      ) : null}

      {/* Session Progress Block */}
      <div className="rounded-xl bg-[#F9FAFB] border border-[#D1D5DB] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-[#111827]">
          <span className="font-bold">Session progress</span>
          <span className="font-bold text-[#020305]">
            {remainingSessions} of {totalSessions} remaining
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-[#10B981] h-full transition-all"
            style={{ width: `${completedPct}%` }}
            title={`Completed: ${completedSessions}`}
          />
          <div
            className="bg-[#38BDF8] h-full transition-all"
            style={{ width: `${scheduledPct}%` }}
            title={`Scheduled: ${scheduledSessions}`}
          />
        </div>

        {/* Stat metrics */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="rounded-lg bg-white p-2 border border-[#D1D5DB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{remainingSessions}</p>
            <p className="text-[11px] font-bold text-[#1F2937]">Remaining</p>
          </div>
          <div className="rounded-lg bg-white p-2 border border-[#D1D5DB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{scheduledSessions}</p>
            <p className="text-[11px] font-bold text-[#1F2937]">Scheduled</p>
          </div>
          <div className="rounded-lg bg-white p-2 border border-[#D1D5DB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{completedSessions}</p>
            <p className="text-[11px] font-bold text-[#1F2937]">Completed</p>
          </div>
        </div>
      </div>

      {/* Financial Breakdown */}
      <dl className="flex flex-col gap-2.5 text-sm pt-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#1F2937] font-semibold">Base package price</dt>
          <dd className="font-bold text-[#020305]">
            {formatBookingMoney(pkg.purchaseSnapshot.bundlePriceCents)}
          </dd>
        </div>

        {!pkg.balanceSettled && pkg.status !== "VOIDED" ? (
          <div className="flex items-start justify-between gap-4 text-[#92400E] font-bold">
            <dt>Outstanding purchase balance</dt>
            <dd className="shrink-0 font-bold">
              {formatBookingMoney(pkg.outstandingBalanceCents)} due at venue
            </dd>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 text-emerald-800 font-bold">
            <dt>Balance status</dt>
            <dd className="shrink-0 font-bold">Settled</dd>
          </div>
        )}
      </dl>

      {/* Pinned Action Footer */}
      <div className="mt-auto pt-3 flex flex-col gap-2.5 w-full">
        <Link
          href={`/customer/packages/${pkg.id}`}
          className="w-full rounded-xl bg-[#0D0D0D] hover:bg-black text-white py-2.5 px-4 font-bold text-sm transition-colors text-center"
        >
          View package
        </Link>

        {isLikelyVoidEligible(pkg) ? (
          <button
            type="button"
            disabled={isRefundPending}
            onClick={() => onRequestRefund(pkg)}
            className="w-full cursor-pointer rounded-xl border border-[#9CA3AF] hover:bg-neutral-50 text-[#111827] py-2.5 px-4 font-bold text-sm transition-colors text-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request refund (unused package)
          </button>
        ) : null}
      </div>
    </article>
  );
}
