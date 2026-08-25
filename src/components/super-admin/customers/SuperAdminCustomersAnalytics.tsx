"use client";

import React from "react";
import type { AnalyticsPeriodParams } from "@/lib/api/superAdminAnalytics";
import { useSuperAdminCustomerAnalyticsQuery } from "@/lib/superAdminAnalytics/hooks";

interface SuperAdminCustomersAnalyticsProps {
  period: AnalyticsPeriodParams;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function SuperAdminCustomersAnalytics({ period }: SuperAdminCustomersAnalyticsProps) {
  const { data, isLoading, isError } = useSuperAdminCustomerAnalyticsQuery(period);

  if (isLoading || !data) {
    return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  }
  if (isError) {
    return <p className="text-sm text-rose-500 py-8 text-center">Failed to load customer analytics.</p>;
  }

  const activationRate = data.registeredTotal > 0 ? Math.round((data.activatedCount / data.registeredTotal) * 1000) / 10 : 0;
  const retentionRate = data.activatedCount > 0 ? Math.round((data.retainedCount / data.activatedCount) * 1000) / 10 : 0;
  const maxRegistrations = Math.max(1, ...data.registeredOverTime.map((m) => m.count));

  const stats = [
    { label: "Registered total", value: data.registeredTotal.toLocaleString(), sub: "All time on platform" },
    { label: "Activation rate", value: `${activationRate}%`, sub: `${data.activatedCount} of ${data.registeredTotal} placed >= 1 booking` },
    { label: "Dormant now", value: data.dormantCount.toLocaleString(), sub: "Registered, never booked" },
  ];

  return (
    <div className="flex flex-col gap-6 w-full font-sans animate-fadeIn">
      <div className="bg-white border border-[#E1DED6] rounded-2xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="bg-[#F5F5F5] py-3.5 px-5 border-b border-[#E1DED6]">
          <h4 className="font-semibold text-lg text-[#282A27]">Customer funnel to Bookly</h4>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-[#E8F1FA] rounded-xl p-4 flex items-center gap-5 border border-[#D5E6F7]">
            <div className="w-16 h-16 rounded-full bg-[#2F5EA0] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
              {data.registeredTotal}
            </div>
            <div>
              <h5 className="font-bold text-xl text-[#1E4378]">Registered on Bookly</h5>
              <p className="text-sm font-medium text-[#1E4378]/90 mt-1">Created an account — 100% of the funnel</p>
            </div>
          </div>

          <div className="bg-[#E5F5EF] rounded-xl p-4 flex items-center gap-5 border border-[#D1EFE4]">
            <div className="w-16 h-16 rounded-full bg-[#326D58] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
              {data.activatedCount}
            </div>
            <div>
              <h5 className="font-bold text-xl text-[#224F42]">Activated — placed at least 1 booking</h5>
              <p className="text-sm font-medium text-[#224F42]/90 mt-1">
                {activationRate}% activation rate — {data.activatedCount} of {data.registeredTotal} registered customers booked
              </p>
            </div>
          </div>

          <div className="bg-[#E5F5EF] rounded-xl p-4 flex items-center gap-5 border border-[#D1EFE4]">
            <div className="w-16 h-16 rounded-full bg-[#4B9C78] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
              {data.retainedCount}
            </div>
            <div>
              <h5 className="font-bold text-xl text-[#224F42]">Retained — booked more than once</h5>
              <p className="text-sm font-medium text-[#224F42]/90 mt-1">
                {retentionRate}% of activated customers returned — {data.retainedCount} of {data.activatedCount} are now repeat customers
              </p>
            </div>
          </div>

          {data.dormantCount > 0 && (
            <div className="bg-[#F8EFDC] rounded-xl p-4 flex items-start gap-3.5 border border-[#F3E2C4]">
              <svg className="w-6 h-6 text-[#5D3A13] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h5 className="font-bold text-lg text-[#5D3A13]">
                  {data.dormantCount} dormant customers — registered but never booked
                </h5>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col justify-between min-h-[110px]">
            <span className="text-[13px] font-medium text-gray-500">{stat.label}</span>
            <span className="text-3xl font-bold text-[#195156] mt-2 mb-1">{stat.value}</span>
            <span className="text-xs text-gray-400 font-normal">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        <div className="bg-[#F5F5F5] p-4 border-b border-gray-200">
          <h3 className="font-semibold text-base text-[#111111]">New customer registrations</h3>
        </div>
        <div className="p-6 flex flex-col gap-3.5">
          {data.registeredOverTime.map((point) => (
            <div key={`${point.year}-${point.month}`} className="flex items-center gap-4 text-sm">
              <span className="w-28 font-medium text-gray-700 text-left shrink-0">
                {MONTH_LABELS[point.month - 1]} {point.year}
              </span>
              <div className="flex-1 h-3 bg-[#F5F4EE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4E88D7] rounded-full transition-all duration-500"
                  style={{ width: `${(point.count / maxRegistrations) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-gray-500 font-medium shrink-0">{point.count}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Email unsubscribe reasons are not available: no email/marketing-tracking system exists in this
        product yet.
      </p>
    </div>
  );
}
