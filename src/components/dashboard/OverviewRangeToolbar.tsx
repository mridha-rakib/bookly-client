"use client";

import React, { useState } from "react";

import type { OverviewRange } from "@/lib/api/dashboardOverview";

const PRESETS = ["Today", "7D", "30D", "Custom"] as const;
const MAX_RANGE_DAYS = 366;

/** Mirrors the API contract (dashboard-overview.schema.ts): both dates, ordered, at most 366
 * calendar days inclusive. Returns a user-facing problem, or null when valid. */
export const validateCustomOverviewRange = (fromDate: string, toDate: string): string | null => {
  if (!fromDate || !toDate) return "Choose both a start and an end date.";
  if (fromDate > toDate) return "The start date must be on or before the end date.";
  const days = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000 + 1;
  if (days > MAX_RANGE_DAYS) return `Choose a range of at most ${MAX_RANGE_DAYS} days.`;
  return null;
};

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

interface OverviewRangeToolbarProps {
  value: OverviewRange;
  onChange: (range: OverviewRange) => void;
}

/** P1.9 — the Staff/Supervisor Overview range control. Only an applied selection reaches
 * `onChange` (and so the request); the highlighted tab is always the applied range. Presets are
 * resolved by the API from the Business-local date: 7D = today + 6 previous days, 30D = today +
 * 29 previous days. */
export default function OverviewRangeToolbar({ value, onChange }: OverviewRangeToolbarProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(value.range === "Custom" ? (value.fromDate ?? "") : "");
  const [customEndDate, setCustomEndDate] = useState(value.range === "Custom" ? (value.toDate ?? "") : "");
  const [customError, setCustomError] = useState<string | null>(null);

  const applyCustom = () => {
    const problem = validateCustomOverviewRange(customStartDate, customEndDate);
    setCustomError(problem);
    if (problem) return;
    onChange({ range: "Custom", fromDate: customStartDate, toDate: customEndDate });
    setShowCustomPicker(false);
  };

  return (
    <div className="flex justify-end mb-6 mt-4 relative">
      <div className="bg-white border border-[#E2E8F0] p-1 rounded-xl shadow-sm flex items-center gap-1">
        {PRESETS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={value.range === tab}
            onClick={() => {
              if (tab === "Custom") {
                setShowCustomPicker((prev) => !prev);
                return;
              }
              setShowCustomPicker(false);
              onChange({ range: tab });
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              value.range === tab ? "bg-[#F1F5F9] text-[#0F172A] shadow-sm" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab === "Custom" && value.range === "Custom" && value.fromDate && value.toDate
              ? `Custom (${shortDate(value.fromDate)} - ${shortDate(value.toDate)})`
              : tab}
          </button>
        ))}
      </div>

      {showCustomPicker && (
        <div className="absolute right-0 top-11 bg-white border border-[#E2E8F0] rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.08)] p-4 z-40 w-72 flex flex-col gap-3 font-poppins text-left">
          <span className="text-[11px] font-bold text-[#888780] uppercase tracking-wider">Select Date Range</span>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="overview-range-start" className="text-xs text-[#5F5E5A] font-medium">Start Date</label>
            <input
              id="overview-range-start"
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="border border-[#ECEBEF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2E9DA7] text-[#0D0D0D] bg-white cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="overview-range-end" className="text-xs text-[#5F5E5A] font-medium">End Date</label>
            <input
              id="overview-range-end"
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="border border-[#ECEBEF] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#2E9DA7] text-[#0D0D0D] bg-white cursor-pointer"
            />
          </div>
          {customError ? (
            <p role="alert" className="text-[11px] font-medium text-red-600">{customError}</p>
          ) : (
            <p className="text-[11px] text-neutral-500">Dates are inclusive, in the Business time zone, up to {MAX_RANGE_DAYS} days.</p>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowCustomPicker(false);
                setCustomStartDate("");
                setCustomEndDate("");
                setCustomError(null);
                onChange({ range: "Today" });
              }}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-50 cursor-pointer text-[#1C1B1C] text-center"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyCustom}
              className="flex-1 px-3 py-2 bg-[#2E9DA7] text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer text-center"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
