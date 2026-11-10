"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { OwnedPackageView } from "@/lib/api/package-views";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useBusinessCatalogQuery } from "@/lib/catalog/hooks";

interface FirstClassPackageCardProps {
  pkg: OwnedPackageView;
}

export default function FirstClassPackageCard({ pkg }: FirstClassPackageCardProps) {
  const catalogQuery = useBusinessCatalogQuery(pkg.businessId);
  const business = catalogQuery.data?.business;

  const purchaseVerified = pkg.purchaseCompletion === "VERIFIED";

  // Calculate aggregate session stats across items
  const totalSessions = pkg.items.reduce((sum, item) => sum + item.total, 0);
  const remainingSessions = pkg.items.reduce((sum, item) => sum + item.remaining, 0);
  const scheduledSessions = pkg.items.reduce((sum, item) => sum + item.scheduled, 0);
  const completedSessions = pkg.items.reduce((sum, item) => sum + item.completed, 0);

  // Determine status presentation
  const isCancelled = pkg.status === "VOIDED" || pkg.status === "CANCELLED";
  const isDepleted = totalSessions > 0 && remainingSessions === 0 && scheduledSessions === 0;
  const isBalanceDue = purchaseVerified && Boolean(pkg.purchaseFinancials && !pkg.purchaseFinancials.balanceSettled);

  let statusLabel = "Active";
  let statusClassName = "bg-emerald-100 text-emerald-800 border-emerald-200";

  if (isCancelled) {
    statusLabel = "Cancelled";
    statusClassName = "bg-neutral-100 text-neutral-600 border-neutral-200";
  } else if (!purchaseVerified) {
    statusLabel = "Purchase incomplete";
    statusClassName = "bg-[#FFF3CD] text-[#8A6D0B] border-amber-200";
  } else if (isBalanceDue) {
    statusLabel = "Balance due";
    statusClassName = "bg-[#FFF3CD] text-[#8A6D0B] border-amber-200";
  } else if (isDepleted) {
    statusLabel = "Exhausted";
    statusClassName = "bg-neutral-100 text-neutral-600 border-neutral-200";
  }

  // Validity date formatting
  const validityText = pkg.validity?.mode === "FOREVER"
    ? "Forever · No expiry"
    : pkg.validity?.expiresAt
    ? `Expires ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: pkg.validity.timezone ?? "UTC",
      }).format(new Date(pkg.validity.expiresAt))} (${pkg.validity.timezone ?? "UTC"})`
    : null;

  const completedPct = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
  const scheduledPct = totalSessions > 0 ? (scheduledSessions / totalSessions) * 100 : 0;

  return (
    <article
      data-testid={`first-class-package-${pkg.id}`}
      className="w-full bg-[#FFFFFF] border border-[#E2E1E6] rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all flex flex-col p-6 gap-5 font-manrope h-full"
    >
      {/* Top Header: Badge, Status, Title, Provider */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#E8F3F4] text-[#1E6B72]">
            First-Class Package
          </span>
          <span
            className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border ${statusClassName}`}
          >
            {statusLabel}
          </span>
        </div>

        <div>
          <h3 className="font-manrope font-bold text-lg sm:text-xl text-[#020305] leading-snug break-words">
            {pkg.name}
          </h3>
          {pkg.items.length > 0 && (
            <p className="mt-1 text-sm text-[#45474B] font-medium line-clamp-1">
              {pkg.items.map((i) => i.name).join(" · ")}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#020305]">
            <Image
              src="/Icons/salonNameIcon.svg"
              className="w-3.5 h-3.5 object-contain opacity-80"
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
      {!purchaseVerified ? (
        <div
          role="status"
          className="rounded-xl bg-[#FFF8DF] border border-[#F5E6B3] p-3 text-xs leading-5 text-[#725B00]"
        >
          <span className="font-semibold block mb-0.5">Purchase not completed</span>
          These sessions cannot be booked or used, and no payment is confirmed.
        </div>
      ) : isBalanceDue ? (
        <div className="rounded-xl bg-[#FFF8DF] border border-[#F5E6B3] p-3 text-xs leading-5 text-[#725B00]">
          <span className="font-semibold block mb-0.5">Scheduling locked</span>
          Remaining sessions are locked until the original balance is settled.
        </div>
      ) : null}

      {/* Validity Text */}
      {validityText && (
        <p className="text-xs text-[#5F5E5A] font-medium">{validityText}</p>
      )}

      {/* Session Progress Block */}
      <div className="rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-[#5F5E5A]">
          <span className="font-medium">Session progress</span>
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
          <div className="rounded-lg bg-white p-2 border border-[#E5E7EB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{remainingSessions}</p>
            <p className="text-[11px] text-[#5F5E5A]">Remaining</p>
          </div>
          <div className="rounded-lg bg-white p-2 border border-[#E5E7EB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{scheduledSessions}</p>
            <p className="text-[11px] text-[#5F5E5A]">Scheduled</p>
          </div>
          <div className="rounded-lg bg-white p-2 border border-[#E5E7EB]">
            <p className="font-manrope font-bold text-sm text-[#020305]">{completedSessions}</p>
            <p className="text-[11px] text-[#5F5E5A]">Completed</p>
          </div>
        </div>

        {/* Multi-service item breakdown if more than 1 item */}
        {pkg.items.length > 1 && (
          <div className="border-t border-[#E5E7EB] pt-2 flex flex-col gap-1 text-xs text-[#5F5E5A]">
            {pkg.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center">
                <span className="line-clamp-1">{item.name}</span>
                <span className="font-medium text-[#020305] shrink-0">
                  {item.remaining} / {item.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Financial Breakdown */}
      <dl className="flex flex-col gap-2.5 text-sm pt-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[#45474B]">Bundle price</dt>
          <dd className="font-semibold text-[#020305]">
            {formatBookingMoney(pkg.bundlePriceCents)}
          </dd>
        </div>

        {pkg.purchaseFinancials && (
          <>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#45474B]">Deposit paid</dt>
              <dd className="font-semibold text-[#020305]">
                {formatBookingMoney(pkg.purchaseFinancials.depositCents)}
              </dd>
            </div>
            {!pkg.purchaseFinancials.balanceSettled ? (
              <div className="flex items-start justify-between gap-4 text-[#8A6D0B]">
                <dt>Outstanding purchase balance</dt>
                <dd className="shrink-0 font-semibold">
                  {formatBookingMoney(pkg.purchaseFinancials.outstandingBalanceCents)} due at venue
                </dd>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 text-emerald-700">
                <dt>Balance status</dt>
                <dd className="shrink-0 font-semibold">Settled</dd>
              </div>
            )}
          </>
        )}
      </dl>

      {/* Pinned Action Footer */}
      <div className="mt-auto pt-3 flex flex-col gap-2 w-full">
        <Link
          href={`/customer/packages/${pkg.id}?kind=first-class`}
          className="w-full rounded-xl bg-[#0D0D0D] hover:bg-black text-white py-2.5 px-4 font-semibold text-sm transition-colors text-center"
        >
          View sessions and balances
        </Link>
      </div>
    </article>
  );
}

