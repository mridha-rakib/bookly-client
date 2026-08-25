"use client";

import React, { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Location05Icon, Calendar01Icon, Tick01Icon, Car04Icon } from "@hugeicons/core-free-icons";
import BusinessOverviewTab from "./BusinessOverviewTab";
import BusinessBookingsTab from "./BusinessBookingsTab";
import BusinessFinanceTab from "./BusinessFinanceTab";
import BusinessIssuesTab from "./BusinessIssuesTab";
import BusinessAnalyticsTab from "./BusinessAnalyticsTab";
import { formatBookingMoney } from "@/lib/bookings/format";
import { useApproveBusinessMutation, useSuperAdminBusinessDetailQuery } from "@/lib/superAdminBusiness/hooks";
import { useSuperAdminBusinessSummaryQuery } from "@/lib/superAdminFinance/hooks";

interface SuperAdminBusinessDetailProps {
  businessId: string;
  onBack: () => void;
  onSuspend: (id: string) => void;
  initialTab?: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Active",
  WARNING: "Warning",
  SUSPENDED: "Suspended",
};

export default function SuperAdminBusinessDetail({
  businessId,
  onBack,
  onSuspend,
  initialTab = "Overview",
}: SuperAdminBusinessDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);
  const { data: business, isLoading, isError } = useSuperAdminBusinessDetailQuery(businessId);
  const approveMutation = useApproveBusinessMutation();

  const period = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }, []);
  const { data: summary } = useSuperAdminBusinessSummaryQuery(businessId, period);

  if (isLoading || !business) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }
  if (isError) {
    return <div className="p-8 text-center text-rose-500">Failed to load this business.</div>;
  }

  const initials = business.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6 w-full max-w-none pb-12 font-sans text-gray-900">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <button onClick={onBack} className="hover:text-gray-900 cursor-pointer bg-transparent border-none p-0">
          Businesses
        </button>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-[#111827]">{business.name}</span>
      </div>

      {/* Sea Green Protection Banner — reuses the same Finance summary primitive as the Finance
          tab (protectedEarningsAllTimeCents), never a duplicate calculation. */}
      <div className="w-full bg-[#2E9DA7] shadow-[0px_1px_2px_rgba(20,30,60,0.08)] rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="flex flex-col gap-2 max-w-[640px]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="font-poppins font-semibold text-[10px] sm:text-xs tracking-[1.32px] uppercase">
              Protected by Bookly
            </span>
          </div>
          <h3 className="font-poppins font-semibold text-lg sm:text-xl md:text-2xl leading-snug tracking-tight">
            No-show & late-cancellation fees recovered for {business.name}
          </h3>
          <p className="font-poppins font-medium text-xs sm:text-sm text-white/80 leading-relaxed">
            Money that would have walked out the door — recovered automatically since this Business joined Bookly.
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end shrink-0">
          <span className="font-poppins font-semibold text-4xl sm:text-5xl text-[#D1F66C] leading-none tracking-tighter">
            {summary ? formatBookingMoney(summary.protectedEarningsAllTimeCents) : "—"}
          </span>
          <span className="font-poppins font-medium text-xs text-white/80 mt-1">All time</span>
        </div>
      </div>

      {/* Business Identity Card */}
      <div className="w-full bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex items-start gap-4 w-full min-w-0">
          <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center font-bold text-lg text-[#4338CA] shrink-0 select-none">
            {initials}
          </div>

          <div className="flex flex-col gap-2 min-w-0 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-sans font-bold text-2xl text-[#111827] tracking-tight leading-tight shrink-0">
                {business.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <div
                  className={`flex items-center justify-center gap-1 border rounded-full text-[13px] font-semibold h-[28px] px-3 shrink-0 ${
                    business.status === "APPROVED"
                      ? "border-[#148655] bg-[#ECF7F3] text-[#148655]"
                      : business.status === "WARNING"
                        ? "border-[#DC2626] bg-[#FDF2F2] text-[#DC2626]"
                        : "border-gray-300 bg-gray-100 text-gray-600"
                  }`}
                >
                  <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 shrink-0" />
                  <span>{STATUS_LABEL[business.status]}</span>
                </div>
                {business.visitType === "TRAVEL_TO_CUSTOMER" && (
                  <div className="flex items-center justify-center gap-1 border border-[#861464] bg-[#FDF2FA] text-[#861464] rounded-full text-[13px] font-semibold h-[28px] px-3 shrink-0">
                    <HugeiconsIcon icon={Car04Icon} className="w-3.5 h-3.5 shrink-0" />
                    <span>Mobile</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-1.5 sm:gap-x-3 text-xs text-[#6B7280]">
              <span>{business.category}</span>
              <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={Location05Icon} className="w-3.5 h-3.5 shrink-0" />
                <span>{business.address.city}</span>
              </div>
              <span className="hidden sm:inline w-1 h-1 rounded-full bg-gray-300 shrink-0" />
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={Calendar01Icon} className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Member since{" "}
                  {new Date(business.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0 justify-start xl:justify-end">
          {business.status === "SUSPENDED" ? (
            <button
              onClick={() => approveMutation.mutate(businessId)}
              disabled={approveMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 h-[32px] border border-[#16A34A] text-[#16A34A] rounded-full text-xs font-semibold hover:bg-emerald-50 cursor-pointer bg-white transition-colors disabled:opacity-50"
            >
              Reactivate
            </button>
          ) : (
            <button
              onClick={() => onSuspend(businessId)}
              className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 h-[32px] border border-[#DC2626] text-[#DC2626] rounded-full text-xs font-semibold hover:bg-red-50 cursor-pointer bg-white transition-colors"
            >
              Suspend
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-row items-center border-b border-[#E5E7EB] gap-1 w-full overflow-x-auto no-scrollbar shrink-0">
        {["Overview", "Bookings", "Finance", "Issues", "Analytics"].map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`h-[38px] px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all border-b border-t-0 border-x-0 cursor-pointer bg-transparent flex items-center justify-center ${
                isActive
                  ? "border-b-2 border-b-[#6366F1] text-[#6366F1]"
                  : "border-b-transparent text-[#6B7280] hover:text-gray-900"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeSubTab === "Overview" && <BusinessOverviewTab businessId={businessId} />}
      {activeSubTab === "Bookings" && <BusinessBookingsTab businessId={businessId} />}
      {activeSubTab === "Finance" && <BusinessFinanceTab businessId={businessId} businessName={business.name} />}
      {activeSubTab === "Issues" && <BusinessIssuesTab businessId={businessId} />}
      {activeSubTab === "Analytics" && <BusinessAnalyticsTab businessId={businessId} />}
    </div>
  );
}
