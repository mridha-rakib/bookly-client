"use client";

import React from "react";
import { useSuperAdminRecentActivityQuery } from "@/lib/superAdminAnalytics/hooks";
import type { SuperAdminActivityEventType } from "@/lib/api/superAdminAnalytics";

const DOT_COLOR: Record<SuperAdminActivityEventType, string> = {
  BUSINESS_APPLICATION: "bg-orange-500",
  BUSINESS_STATUS_CHANGED: "bg-amber-500",
  CUSTOMER_REGISTERED: "bg-blue-500",
  PAYOUT_PAID: "bg-emerald-500",
};

const formatRelativeTime = (isoInstant: string): string => {
  const diffMs = Date.now() - new Date(isoInstant).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/** Batch 12 — real Recent Activity, derived from Business creation/statusHistory, Customer
 * registration, and Payout records (deferred in Batch 11 for lack of a real derivation; never a
 * new audit/event system — see the backend service's own doc comment). */
export default function SuperAdminRecentActivity() {
  const { data, isLoading, isError } = useSuperAdminRecentActivityQuery(10);

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-4 w-full">
      <div className="flex justify-between items-center w-full">
        <h4 className="font-sans font-semibold text-lg text-[#111827]">Recent Activity</h4>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
      {isError && <p className="text-xs text-rose-500">Failed to load.</p>}
      {data && data.activities.length === 0 && (
        <p className="text-xs text-gray-400">Nothing has happened yet.</p>
      )}

      {data && data.activities.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          {data.activities.map((activity, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 font-sans text-xs pb-3 border-b border-gray-50 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLOR[activity.type]}`} />
                <p className="text-gray-600">{activity.summary}</p>
              </div>
              <span className="text-gray-400 text-[11px] shrink-0 font-medium">
                {formatRelativeTime(activity.occurredAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
