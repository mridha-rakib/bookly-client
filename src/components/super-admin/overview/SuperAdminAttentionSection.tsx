"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useSuperAdminDashboardSummaryQuery } from "@/lib/superAdminDashboard/hooks";
import { useSuperAdminPendingPayoutsQuery } from "@/lib/superAdminFinance/hooks";

interface SuperAdminAttentionSectionProps {
  setActiveTab?: (tab: string) => void;
}

/** Batch 11 — "Unread Support Messages" was dropped: no ticket/support backend exists anywhere
 * in this codebase (confirmed by investigation), so this card is deferred rather than showing a
 * fabricated count. Every remaining card reads a real, server-aggregated number. */
export default function SuperAdminAttentionSection({ setActiveTab }: SuperAdminAttentionSectionProps) {
  const { data: summary, isLoading } = useSuperAdminDashboardSummaryQuery();
  const { data: pendingPayouts } = useSuperAdminPendingPayoutsQuery();

  if (isLoading || !summary) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <h3 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">Needs your attention</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-5 min-h-[177px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Pending Applications",
      value: summary.businesses.PENDING.toString(),
      sub: `${summary.businesses.PENDING} Business awaiting review`,
      linkText: "Review",
      bg: "bg-[#FFF2EB]",
      textColor: "text-[#E05E2B]",
      targetTab: "Businesses",
    },
    {
      title: "Flagged Businesses",
      value: summary.businesses.WARNING.toString(),
      sub: `${summary.businesses.WARNING} Business flagged with a warning`,
      linkText: "Review",
      bg: "bg-[#FFEBEB]",
      textColor: "text-[#E24B4A]",
      targetTab: "Businesses",
    },
    {
      title: "Pending Payouts",
      value: formatBookingMoney(summary.pendingBusinessPayableCents),
      sub: pendingPayouts ? `${pendingPayouts.businessCount} Business due` : "—",
      linkText: "Process",
      bg: "bg-[#FEF9C3]/70",
      textColor: "text-[#854D0E]",
      targetTab: "Finance",
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      <h3 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">Needs your attention</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`${card.bg} rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[177px]`}
          >
            <div className="flex flex-col gap-2">
              <span className="font-sans font-medium text-[13px] text-gray-500 leading-4">{card.title}</span>
              <span className={`font-sans font-bold text-[32px] leading-[35px] ${card.textColor}`}>{card.value}</span>
              <span className="font-sans font-normal text-xs text-gray-500 leading-4">{card.sub}</span>
            </div>

            <button
              onClick={() => setActiveTab?.(card.targetTab)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#195156] mt-4 hover:underline self-start cursor-pointer bg-transparent border-none"
            >
              <span>{card.linkText}</span>
              <HugeiconsIcon icon={ArrowRight02Icon} className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
