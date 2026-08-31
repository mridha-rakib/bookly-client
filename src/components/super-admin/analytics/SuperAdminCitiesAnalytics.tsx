"use client";

import React from "react";
import { useSuperAdminCityCoverageQuery } from "@/lib/superAdminAnalytics/hooks";

interface SuperAdminCitiesAnalyticsProps {
  setActiveTab?: (tab: string) => void;
}

/** Batch 12 — real Business-per-city coverage (all-time, current-state). Booking-volume-by-city
 * has no real aggregate built yet — reported here rather than fabricated, matching the mock's
 * old "Booking volume by city" section which had no backend equivalent. */
export default function SuperAdminCitiesAnalytics({ setActiveTab }: SuperAdminCitiesAnalyticsProps) {
  const { data, isLoading, isError, refetch } = useSuperAdminCityCoverageQuery();

  if (isError) {
    return (
      <div className="py-8 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-rose-500">Failed to load city coverage.</p>
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

  const maxTotal = Math.max(1, ...data.cities.map((c) => c.premisesCount + c.mobileCount));

  return (
    <div className="flex flex-col gap-8 w-full font-sans animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {data.cities.map((city) => (
          <div
            key={city.city}
            className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col justify-between min-h-[110px]"
          >
            <span className="text-[13px] font-medium text-gray-500">{city.city}</span>
            <span className="text-3xl font-bold text-[#195156] mt-2 mb-1">
              {city.premisesCount + city.mobileCount}
            </span>
            <span className="text-xs text-gray-400 font-normal">
              {city.premisesCount} premises · {city.mobileCount} mobile · {city.approvedCount} approved
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden flex flex-col w-full">
        <div className="bg-[#F5F5F5] p-4 border-b border-gray-200">
          <h3 className="font-semibold text-base text-[#111111] leading-none">Businesses by city</h3>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {data.cities.map((city) => (
            <div key={city.city} className="flex items-center gap-4 text-sm justify-between">
              <span className="w-28 font-medium text-gray-700 text-left shrink-0">{city.city}</span>
              <div className="flex-1 h-3 bg-[#F5F4EE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#4E88D7] rounded-full transition-all duration-500"
                  style={{ width: `${((city.premisesCount + city.mobileCount) / maxTotal) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="w-12 text-right text-gray-900 font-semibold">
                  {city.premisesCount + city.mobileCount}
                </span>
                <button
                  onClick={() => setActiveTab?.("Businesses")}
                  className="px-3 py-1 border border-[#2E9DA7] text-[#195156] hover:bg-[#2E9DA7]/10 transition-colors text-xs font-semibold rounded-lg cursor-pointer"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Booking volume by city is not available yet — no per-city booking aggregate has been built.
      </p>
    </div>
  );
}
