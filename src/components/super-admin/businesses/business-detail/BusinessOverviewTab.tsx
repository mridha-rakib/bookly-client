"use client";

import React from "react";
import { useSuperAdminBusinessDetailQuery } from "@/lib/superAdminBusiness/hooks";

interface BusinessOverviewTabProps {
  businessId: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  WARNING: "Warning",
  SUSPENDED: "Suspended",
};

export default function BusinessOverviewTab({ businessId }: BusinessOverviewTabProps) {
  const { data: business, isLoading, isError } = useSuperAdminBusinessDetailQuery(businessId);

  if (isLoading || !business) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }
  if (isError) {
    return <div className="p-8 text-center text-rose-500">Failed to load this business.</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full text-gray-900">
      {/* Bookings summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#6B7280]">Total Bookings</span>
          <span className="text-3xl font-bold text-[#195156] mt-1">{business.bookingsCount}</span>
          <span className="text-[11px] text-[#6B7280] mt-1">All time — see the Bookings tab for detail</span>
        </div>
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#6B7280]">Current Status</span>
          <span className="text-3xl font-bold text-[#195156] mt-1">{STATUS_LABEL[business.status]}</span>
          <span className="text-[11px] text-[#6B7280] mt-1">See Status History below for the full audit trail</span>
        </div>
      </div>

      {/* Business Info & Owner Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-stretch">
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-lg text-[#111827]">Business Info</h3>
          </div>
          <div className="flex flex-col flex-grow">
            <Row label="Business name" value={business.name} />
            <Row label="Business Type" value={business.visitType === "TRAVEL_TO_CUSTOMER" ? "Mobile" : "Premises"} />
            <Row label="Category" value={business.category} />
            <Row label="Sub Category" value={business.subcategories.join(", ") || "—"} />
            <Row label="City" value={business.address.city} />
            <Row
              label="Address"
              value={`${business.address.streetNumber} ${business.address.streetName}, ${business.address.area}`}
              last
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-lg text-[#111827]">Owner Info</h3>
          </div>
          <div className="flex flex-col">
            <Row label="Owner name" value={business.ownerName} />
            <Row
              label="Email"
              value={
                <a href={`mailto:${business.owner.email}`} className="text-[#2563EB] font-medium hover:underline">
                  {business.owner.email}
                </a>
              }
            />
            <Row
              label="Phone"
              value={
                <a href={`tel:${business.phone.e164}`} className="text-[#2563EB] font-medium hover:underline">
                  {business.phone.e164}
                </a>
              }
            />
            <Row label="Account status" value={business.owner.status} last />
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
        <div className="pb-3 border-b border-gray-200">
          <h3 className="font-semibold text-lg text-[#111827]">Additional Info</h3>
        </div>
        <div className="flex py-3.5 items-start text-sm">
          <span className="w-[180px] sm:w-[260px] text-[#6B7280] font-medium shrink-0">Brief description</span>
          <span className="text-[#111827] font-medium">{business.briefDescription}</span>
        </div>
      </div>

      {/* Status History — the real, server-authoritative audit trail (Batch 11). */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
        <div className="pb-2 border-b border-gray-100">
          <h3 className="font-semibold text-base text-[#111827] uppercase tracking-wider">Status History</h3>
        </div>
        {business.statusHistory.length === 0 ? (
          <p className="text-sm text-gray-400">No status changes recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {business.statusHistory.map((entry, idx) => (
              <div key={idx} className="flex justify-between items-start text-xs sm:text-sm py-1.5 border-b border-gray-50 last:border-b-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-gray-700 font-medium">
                    {STATUS_LABEL[entry.fromStatus] ?? entry.fromStatus} → {STATUS_LABEL[entry.toStatus] ?? entry.toStatus}
                  </span>
                  <span className="text-gray-400">
                    {entry.actorEmail ?? entry.actorUserId}
                    {entry.reason ? ` — "${entry.reason}"` : ""}
                  </span>
                </div>
                <span className="text-gray-400 shrink-0 ml-4">
                  {new Date(entry.changedAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex py-3 text-sm ${last ? "" : "border-b border-gray-100"}`}>
      <span className="w-[160px] sm:w-[200px] text-[#6B7280] font-medium shrink-0">{label}</span>
      <span className="text-[#111827] font-medium">{value}</span>
    </div>
  );
}
