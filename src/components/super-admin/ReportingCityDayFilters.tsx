"use client";

import React from "react";

import type { ReportingDay } from "@/lib/api/superAdminAnalytics";
import { useSuperAdminReportingCitiesQuery } from "@/lib/superAdminAnalytics/hooks";

/** P2.2.4 — Super Admin City and Day selectors, shared by Overview and Analytics.
 * City = the registered city of the Business an activity belongs to (options are the real
 * distinct registered cities from the API). Day = the Cyprus (Europe/Nicosia) day of week of
 * each metric's own event timestamp. */
export type ReportingCityDay = { city?: string; day?: ReportingDay };

export const REPORTING_DAYS: Array<{ value: ReportingDay; label: string }> = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

export const dayLabel = (day: ReportingDay | undefined) =>
  REPORTING_DAYS.find((entry) => entry.value === day)?.label;

/** e.g. "Limassol · Mondays (Cyprus time)", or "" when nothing is selected. */
export const describeCityDay = ({ city, day }: ReportingCityDay): string =>
  [city, day ? `${dayLabel(day)}s (Cyprus time)` : undefined].filter(Boolean).join(" · ");

export default function ReportingCityDayFilters({
  value,
  onChange,
  className,
}: {
  value: ReportingCityDay;
  onChange: (value: ReportingCityDay) => void;
  className: string;
}) {
  const citiesQuery = useSuperAdminReportingCitiesQuery();
  const cities = citiesQuery.data?.cities ?? [];

  return (
    <>
      <select
        aria-label="City"
        value={value.city ?? ""}
        disabled={citiesQuery.isPending || citiesQuery.isError}
        title={citiesQuery.isError ? "Cities could not be loaded" : "Business registered city"}
        onChange={(event) => onChange({ ...value, city: event.target.value || undefined })}
        className={className}
      >
        <option value="">{citiesQuery.isError ? "Cities unavailable" : "All cities"}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
      {citiesQuery.isError && (
        <button
          type="button"
          onClick={() => void citiesQuery.refetch()}
          className="text-[12px] font-medium text-[#314158] underline"
        >
          Retry cities
        </button>
      )}
      <select
        aria-label="Day"
        value={value.day ?? ""}
        title="Day of week in Cyprus time"
        onChange={(event) => onChange({ ...value, day: (event.target.value || undefined) as ReportingDay | undefined })}
        className={className}
      >
        <option value="">All days</option>
        {REPORTING_DAYS.map((day) => (
          <option key={day.value} value={day.value}>
            {day.label}
          </option>
        ))}
      </select>
    </>
  );
}
