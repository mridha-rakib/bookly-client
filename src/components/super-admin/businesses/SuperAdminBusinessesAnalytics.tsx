"use client";

import React, { useState } from "react";
import type { AnalyticsPeriodParams } from "@/lib/api/superAdminAnalytics";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useSuperAdminBusinessAnalyticsQuery } from "@/lib/superAdminAnalytics/hooks";

interface SuperAdminBusinessesAnalyticsProps {
  period: AnalyticsPeriodParams;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type RankBy = "bookings" | "newCustomers" | "revenue";

export default function SuperAdminBusinessesAnalytics({ period }: SuperAdminBusinessesAnalyticsProps) {
  const [rankBy, setRankBy] = useState<RankBy>("bookings");
  const { data, isLoading, isError, refetch } = useSuperAdminBusinessAnalyticsQuery(period);

  if (isError) {
    return (
      <div className="py-8 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-rose-500">Failed to load business analytics.</p>
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

  const rows =
    rankBy === "bookings" ? data.topByBookings : rankBy === "newCustomers" ? data.topByNewCustomers : data.topByRevenue;
  const maxCreated = Math.max(1, ...data.createdOverTime.map((m) => m.count));

  return (
    <div className="flex flex-col gap-8 w-full font-sans animate-fadeIn">
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="bg-[#F5F5F5] py-4 px-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-semibold text-base text-[#111111]">Top 5 Businesses</h3>
          <div className="flex items-center gap-2">
            {(
              [
                { key: "bookings" as const, label: "By Bookings" },
                { key: "newCustomers" as const, label: "By New Customers" },
                { key: "revenue" as const, label: "By Bookly Revenue" },
              ]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRankBy(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  rankBy === opt.key ? "bg-[#111111] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 p-6">No businesses with activity in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                  <th className="py-3 px-6">Business</th>
                  <th className="py-3 px-6">City</th>
                  <th className="py-3 px-6 text-center">New Customers</th>
                  <th className="py-3 px-6 text-center">Bookings</th>
                  <th className="py-3 px-6 text-center">Return Rate</th>
                  <th className="py-3 px-6 text-right">Bookly Revenue</th>
                  <th className="py-3 px-6 text-center">No-Show Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {rows.map((biz) => (
                  <tr key={biz.businessId} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">{biz.name}</td>
                    <td className="py-4 px-6 text-gray-600">{biz.city}</td>
                    <td className="py-4 px-6 text-center text-gray-700 font-medium">{biz.newCustomersCount}</td>
                    <td className="py-4 px-6 text-center text-gray-600">{biz.bookingsCount}</td>
                    <td className="py-4 px-6 text-center text-gray-600">
                      {biz.returnRate === null ? "—" : `${Math.round(biz.returnRate * 100)}%`}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-[#195156]">
                      {formatBookingMoney(biz.bookyRevenueCents)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        {Math.round(biz.noShowRate * 1000) / 10}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        <div className="bg-[#F5F5F5] py-4 px-6 border-b border-gray-200">
          <h3 className="font-semibold text-base text-[#111111]">New Businesses joined Bookly / month</h3>
        </div>
        <div className="p-6 flex flex-col gap-3.5">
          {data.createdOverTime.map((point) => (
            <div key={`${point.year}-${point.month}`} className="flex items-center gap-4 text-sm">
              <span className="w-28 font-medium text-gray-700 text-left shrink-0">
                {MONTH_LABELS[point.month - 1]} {point.year}
              </span>
              <div className="flex-1 h-3 bg-[#F5F4EE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4E88D7] rounded-full transition-all duration-500"
                  style={{ width: `${(point.count / maxCreated) * 100}%` }}
                />
              </div>
              <span className="w-24 text-right text-gray-500 font-medium shrink-0">
                {point.count} {point.count === 1 ? "business" : "businesses"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-wrap gap-6">
        {(
          [
            { label: "Approved", value: data.statusCounts.APPROVED },
            { label: "Pending", value: data.statusCounts.PENDING },
            { label: "Warning", value: data.statusCounts.WARNING },
            { label: "Suspended", value: data.statusCounts.SUSPENDED },
          ]
        ).map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">{s.label}</span>
            <span className="text-2xl font-bold text-[#195156]">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
