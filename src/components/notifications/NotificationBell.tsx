"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BellIcon } from "@hugeicons/core-free-icons";

export default function NotificationBell() {
  // Email/SMS delivery outboxes do not provide an authenticated in-app inbox.
  // Preserve the header control's placement without claiming events or unread state.
  return (
    <div className="relative">
      <button
        type="button"
        disabled
        aria-label="Notifications unavailable"
        title="In-app notifications are unavailable."
        className="w-9 h-9 border border-[#E8E8E6] bg-white rounded-lg flex items-center justify-center transition-all shadow-sm cursor-default"
      >
        <HugeiconsIcon icon={BellIcon} className="w-[18px] h-[18px] text-[#5F5E5A]" />
      </button>
    </div>
  );
}
