"use client";

import React from "react";
import { useSuperAdminTopServicesQuery } from "@/lib/superAdminAnalytics/hooks";
import { describeOverviewPeriod, type OverviewPeriodParams } from "@/lib/superAdminDashboard/period";

/** Batch 12 — real, server-aggregated Top Services (deferred in Batch 11 for lack of a real
 * primitive). Each row's name comes from the persisted booking snapshot, never a live Service
 * lookup, so an archived/deleted Service still resolves correctly. */
export default function SuperAdminTopServices({ period }: { period?: OverviewPeriodParams }) {
  // P1.9 — Bookings created in the selected Overview period (all time when none).
  const { data, isLoading, isError, isFetching, refetch } = useSuperAdminTopServicesQuery({ ...period, limit: 6 });
  const periodLabel = describeOverviewPeriod(period);

  return (
    <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-4 w-full h-full">
      <div>
        <h4 className="font-sans font-semibold text-base text-[#111827]">Top services by bookings</h4>
        <span className="font-sans text-xs text-gray-400">{periodLabel} · Bookings created</span>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
      {isError && !data && (
        <p role="alert" className="text-xs text-rose-500">
          Failed to load.{" "}
          <button type="button" className="underline" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </p>
      )}

      {data && data.services.length === 0 && (
        <p className="text-xs text-gray-400">No bookings created in this period.</p>
      )}

      {data && data.services.length > 0 && (
        <div className="flex flex-col gap-3.5 mt-2">
          {(() => {
            const max = Math.max(...data.services.map((s) => s.count));
            return data.services.map((service) => {
              const widthPercent = max > 0 ? (service.count / max) * 100 : 0;
              return (
                <div
                  key={service.serviceId}
                  className="flex items-center justify-between gap-4 font-sans text-xs"
                >
                  <span className="w-2/5 text-gray-700 font-medium truncate" title={service.businessName}>
                    {service.name}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#111111] rounded-full transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-900 font-semibold">{service.count}</span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}
