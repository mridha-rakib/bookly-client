"use client";

import React from "react";
import type { AnalyticsPeriodParams } from "@/lib/api/superAdminAnalytics";
import { BOOKING_STATUS_LABELS } from "@/lib/bookings/format";
import { useSuperAdminBookingAnalyticsQuery } from "@/lib/superAdminAnalytics/hooks";

interface SuperAdminBookingsAnalyticsProps {
  period: AnalyticsPeriodParams;
}

function SplitBar({
  leftLabel,
  leftCount,
  rightLabel,
  rightCount,
  note,
}: {
  leftLabel: string;
  leftCount: number;
  rightLabel: string;
  rightCount: number;
  note: string;
}) {
  const total = leftCount + rightCount;
  const leftPct = total > 0 ? Math.round((leftCount / total) * 1000) / 10 : 0;
  const rightPct = total > 0 ? Math.round((rightCount / total) * 1000) / 10 : 0;

  return (
    <div className="p-5 flex flex-col gap-6 justify-between flex-grow">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-medium text-[#111111]">
            <span>{leftLabel}</span>
            <span className="text-[#2E9DA7] font-semibold">
              {leftCount} - {leftPct}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F5F4EE] rounded-full overflow-hidden">
            <div className="h-full bg-[#4E88D7] rounded-full" style={{ width: `${leftPct}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm font-medium text-[#111111]">
            <span>{rightLabel}</span>
            <span className="text-[#2E9DA7] font-semibold">
              {rightCount} - {rightPct}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#F5F4EE] rounded-full overflow-hidden">
            <div className="h-full bg-[#4E88D7] rounded-full" style={{ width: `${rightPct}%` }} />
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600 border-t border-gray-150 pt-4 mt-2 italic leading-relaxed">{note}</p>
    </div>
  );
}

export default function SuperAdminBookingsAnalytics({ period }: SuperAdminBookingsAnalyticsProps) {
  const { data, isLoading, isError, refetch } = useSuperAdminBookingAnalyticsQuery(period);

  if (isError) {
    return (
      <div className="py-8 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-rose-500">Failed to load booking analytics.</p>
        <button
          onClick={() => void refetch()}
          className="border border-[#111111] text-[#111111] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
  if (isLoading || !data) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }

  const statuses = (Object.keys(data.statusCounts) as Array<keyof typeof data.statusCounts>)
    .map((status) => ({ label: BOOKING_STATUS_LABELS[status], value: data.statusCounts[status] }))
    .filter((s) => s.value > 0);

  const nonManualTotal = data.clientTypeSplit.newBooking + data.clientTypeSplit.returning;

  return (
    <div className="flex flex-col gap-6 w-full font-sans animate-fadeIn">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#111111]">
          All booking statuses — {data.totalCount.toLocaleString()} total bookings in period
        </h3>
      </div>

      {statuses.length === 0 ? (
        <p className="text-sm text-gray-400">No bookings in this period.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {statuses.map((stat) => (
            <div
              key={stat.label}
              className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col justify-between min-h-[100px]"
            >
              <span className="text-[13px] font-medium text-gray-500">{stat.label}</span>
              <span className="text-3xl font-bold text-[#195156] mt-2">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E1DED6] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
          <div className="bg-[#F5F5F5] py-3.5 px-5 border-b border-[#E1DED6]">
            <h4 className="font-semibold text-lg text-[#282A27]">New VS Returning bookings</h4>
          </div>
          {nonManualTotal === 0 ? (
            <p className="text-sm text-gray-400 p-5">No non-manual bookings in this period.</p>
          ) : (
            <SplitBar
              leftLabel="New (platform fee)"
              leftCount={data.clientTypeSplit.newBooking}
              rightLabel="Returning (no Bookly fee)"
              rightCount={data.clientTypeSplit.returning}
              note="Only a customer's first eligible booking at a Business generates a platform fee."
            />
          )}
        </div>

        <div className="bg-white border border-[#E1DED6] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
          <div className="bg-[#F5F5F5] py-3.5 px-5 border-b border-[#E1DED6]">
            <h4 className="font-semibold text-lg text-[#282A27]">Platform VS Manual bookings</h4>
          </div>
          {data.totalCount === 0 ? (
            <p className="text-sm text-gray-400 p-5">No bookings in this period.</p>
          ) : (
            <SplitBar
              leftLabel="Platform bookings"
              leftCount={nonManualTotal}
              rightLabel="Manual bookings"
              rightCount={data.clientTypeSplit.manual}
              note="Manual bookings block calendar slots only — they never generate a Bookly platform fee."
            />
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E1DED6] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">
        <div className="bg-[#F5F5F5] py-3.5 px-5 border-b border-[#E1DED6]">
          <h4 className="font-semibold text-lg text-[#282A27]">Premises VS Mobile bookings</h4>
        </div>
        {data.totalCount === 0 ? (
          <p className="text-sm text-gray-400 p-5">No bookings in this period.</p>
        ) : (
          <SplitBar
            leftLabel="Premises bookings"
            leftCount={data.fulfilmentSplit.premises}
            rightLabel="Mobile bookings"
            rightCount={data.fulfilmentSplit.mobile}
            note="Mobile travel fees go 100% to the Business — Bookly takes €0 of them."
          />
        )}
      </div>

      <p className="text-xs text-gray-400 italic">
        Booking by category is not available: a booking&apos;s service snapshot does not persist a category.
      </p>
    </div>
  );
}
