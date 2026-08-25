"use client";

import React, { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useSuperAdminPlatformSummaryQuery } from "@/lib/superAdminFinance/hooks";

/** Batch 11 — reuses the exact same platform Finance summary primitive as the Finance tab
 * (protectedEarningsAllTimeCents), never a duplicate calculation. */
export default function SuperAdminOverviewBanner() {
  const period = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, []);
  const { data: summary } = useSuperAdminPlatformSummaryQuery(period);

  return (
    <div className="w-full bg-[#2E9DA7] rounded-2xl p-7 shadow-sm text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
      <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-10 translate-y-10">
        <div className="w-64 h-64 rounded-full border-[16px] border-white" />
      </div>

      <div className="flex flex-col gap-2 max-w-[640px]">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 border border-white rounded-full flex items-center justify-center">
            <HugeiconsIcon icon={Tick01Icon} className="w-2.5 h-2.5 text-white" />
          </span>
          <span className="font-sans font-semibold text-[11px] leading-4 tracking-[1.32px] uppercase">
            Protected by Bookly
          </span>
        </div>

        <h2 className="font-sans font-semibold text-[20px] leading-[30px] tracking-tight">
          Total no-show & late-cancellation fees recovered platform-wide
        </h2>

        <p className="font-sans font-medium text-[13px] leading-5 text-white/60">
          No-show and cancellation fees collected on your behalf to protect local service businesses from lost revenue.
        </p>
      </div>

      <div className="flex flex-col items-start md:items-end flex-shrink-0">
        <div className="font-sans font-semibold text-[42px] leading-[42px] tracking-[-2.1px] text-[#D1F66C]">
          {summary ? formatBookingMoney(summary.protectedEarningsAllTimeCents) : "—"}
        </div>
        <div className="font-sans font-medium text-xs leading-[18px] text-white/80 mt-2">All time · platform-wide</div>
      </div>
    </div>
  );
}
