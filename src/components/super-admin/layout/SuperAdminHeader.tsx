"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";

import NotificationBell from "@/components/notifications/NotificationBell";
import { useCurrentUserQuery } from "@/lib/auth/hooks";

interface SuperAdminHeaderProps {
  isCollapsed: boolean;
}

const initialsFrom = (fullName: string, email: string): string => {
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
  }
  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }
  return (email.slice(0, 2) || "AD").toUpperCase();
};

export default function SuperAdminHeader({ isCollapsed }: SuperAdminHeaderProps) {
  const meQuery = useCurrentUserQuery();
  const initials = initialsFrom(
    meQuery.data?.profile?.fullName ?? "",
    meQuery.data?.user.email ?? "",
  );
  return (
    <header
      className={`fixed top-0 h-[70px] bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-20 transition-all duration-300 ${
        isCollapsed ? "left-[72px] w-[calc(100%-72px)]" : "left-[240px] w-[calc(100%-240px)]"
      }`}
    >
      {/* Search Input Container */}
      <div className="relative w-[400px] h-10">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <HugeiconsIcon icon={Search01Icon} className="w-5 h-5" />
        </span>
        <input
          type="text"
          placeholder="Search businesses, customers, bookings..."
          className="w-full h-full pl-10 pr-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-sm text-[#111111] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell Button */}
        <NotificationBell />

        {/* User Initials Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#4338CA] text-xs font-bold font-sans">
          {initials}
        </div>
      </div>
    </header>
  );
}
