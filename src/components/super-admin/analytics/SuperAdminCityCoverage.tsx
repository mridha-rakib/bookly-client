"use client";

import React from "react";
import { useSuperAdminCityCoverageQuery } from "@/lib/superAdminAnalytics/hooks";

/** Batch 12 — real, server-aggregated City Coverage (deferred in Batch 11 pending confirmation
 * that Business.address.city is reliable — confirmed: it's enum-validated at registration). */
export default function SuperAdminCityCoverage() {
  const { data, isLoading, isError } = useSuperAdminCityCoverageQuery();

  const totalPremises = data?.cities.reduce((sum, c) => sum + c.premisesCount, 0) ?? 0;
  const totalMobile = data?.cities.reduce((sum, c) => sum + c.mobileCount, 0) ?? 0;

  return (
    <div className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-4 w-full h-full">
      <div>
        <h4 className="font-sans font-semibold text-base text-[#111827]">City coverage</h4>
        <span className="font-sans text-xs text-gray-500">Businesses by city — Premises vs Mobile</span>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
      {isError && <p className="text-xs text-rose-500">Failed to load.</p>}

      {data && data.cities.length === 0 && <p className="text-xs text-gray-400">No businesses yet.</p>}

      {data && data.cities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase">
                <th className="py-2">City</th>
                <th className="py-2 text-right">Premises</th>
                <th className="py-2 text-right">Mobile</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {data.cities.map((city) => (
                <tr key={city.city} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2.5 font-medium">{city.city}</td>
                  <td className="py-2.5 text-right">{city.premisesCount}</td>
                  <td className="py-2.5 text-right">{city.mobileCount}</td>
                </tr>
              ))}
              <tr className="font-semibold text-gray-900 bg-gray-50/30">
                <td className="py-2.5">Total</td>
                <td className="py-2.5 text-right">{totalPremises}</td>
                <td className="py-2.5 text-right">{totalMobile}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
