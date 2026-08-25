"use client";

import React from "react";
import { useSuperAdminTopServicesQuery } from "@/lib/superAdminAnalytics/hooks";

/** Batch 12 — real, server-aggregated Top Services (deferred in Batch 11 for lack of a real
 * primitive). Each row's name comes from the persisted booking snapshot, never a live Service
 * lookup, so an archived/deleted Service still resolves correctly. */
export default function SuperAdminTopServices() {
  const { data, isLoading, isError } = useSuperAdminTopServicesQuery({ limit: 6 });

  return (
    <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-4 w-full h-full">
      <div>
        <h4 className="font-sans font-semibold text-base text-[#111827]">Top services by bookings</h4>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
      {isError && <p className="text-xs text-rose-500">Failed to load.</p>}

      {data && data.services.length === 0 && (
        <p className="text-xs text-gray-400">No bookings in the last 365 days.</p>
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
