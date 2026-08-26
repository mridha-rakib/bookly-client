"use client";

import React from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { buildDashboardSubtitle } from "@/utils/dashboardGreeting";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
}

export default function DashboardHeader({
  title,
  subtitle = buildDashboardSubtitle(undefined)
}: DashboardHeaderProps) {
  return (
    <div className="h-16 bg-[#FCF8F8] px-6 flex items-center justify-between shrink-0 select-none border-b border-[#C6C6CB]">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A1A] font-poppins">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-neutral-500 font-poppins mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <NotificationBell />
    </div>
  );
}
