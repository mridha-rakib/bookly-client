"use client";

import React from "react";

import { formatBookingMoney } from "@/lib/bookings/format";

interface SuperAdminFinanceBannerProps {
  protectedEarningsAllTimeCents?: number;
}

export default function SuperAdminFinanceBanner({
  protectedEarningsAllTimeCents,
}: SuperAdminFinanceBannerProps) {
  return (
    <div className="w-full bg-[#2E9DA7] text-white p-6 rounded-2xl shadow-[0px_4px_12px_rgba(20,30,60,0.08)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div className="flex flex-col gap-2 max-w-2xl">
        {/* Protected Tag */}
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-white/90 uppercase">
          <img
            src="/Icons/protectIcon.svg"
            alt="protect icon"
            className="w-4 h-4 shrink-0 invert brightness-0"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span>Protected by Bookly</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg sm:text-xl leading-tight">
          No-show & late-cancellation fees recovered across all businesses
        </h3>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-white/80 font-normal">
          No-show and cancellation fees collected on your behalf automatically since launch
        </p>
      </div>

      {/* Recovered Amount Indicator */}
      <div className="flex flex-col items-start md:items-end shrink-0">
        <span className="text-4xl sm:text-5xl font-bold tracking-tight text-[#D1F66C] leading-none">
          {protectedEarningsAllTimeCents !== undefined
            ? formatBookingMoney(protectedEarningsAllTimeCents)
            : "—"}
        </span>
        <span className="text-[12px] font-medium text-white/85 mt-2">
          All time · platform-wide
        </span>
      </div>
    </div>
  );
}
