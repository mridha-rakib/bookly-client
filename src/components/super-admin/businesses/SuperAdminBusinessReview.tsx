"use client";

import React, { useState } from "react";
import { useSuperAdminBusinessDetailQuery } from "@/lib/superAdminBusiness/hooks";

interface SuperAdminBusinessReviewProps {
  businessId: string;
  onBack: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}

export default function SuperAdminBusinessReview({
  businessId,
  onBack,
  onApprove,
  onReject,
}: SuperAdminBusinessReviewProps) {
  const { data: detail, isLoading, isError } = useSuperAdminBusinessDetailQuery(businessId);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (isLoading || !detail) {
    return <div className="p-8 text-center text-gray-400">Loading application…</div>;
  }
  if (isError) {
    return <div className="p-8 text-center text-rose-500">Failed to load this application.</div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-none pb-12 font-sans">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <button onClick={onBack} className="hover:text-gray-900 cursor-pointer bg-transparent border-none p-0">
          Businesses
        </button>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-[#111827]">Application Review</span>
      </div>

      {/* Header / Title Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 w-full">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">
            Business Application
          </h2>
          <div className="bg-[#D97706]/10 text-[#D97706] font-semibold text-xs py-1.5 px-3.5 rounded-full shrink-0">
            Pending Review
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => setShowRejectForm((v) => !v)}
            className="flex items-center justify-center gap-2 border border-[#DC2626] bg-[#F5EEEE] text-[#DC2626] rounded-full text-xs font-semibold py-2 px-5 cursor-pointer hover:bg-red-50 transition-colors w-full sm:w-auto"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="whitespace-nowrap">Reject Application</span>
          </button>

          <button
            onClick={() => onApprove(detail.id)}
            className="flex items-center justify-center gap-2 bg-[#16A34A] text-white rounded-full text-xs font-semibold py-2 px-5 cursor-pointer hover:bg-[#16A34A]/90 transition-colors w-full sm:w-auto"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="whitespace-nowrap">Approve</span>
          </button>
        </div>
      </div>

      {showRejectForm && (
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-3">
          <label htmlFor="reject-reason" className="text-sm font-medium text-[#111827]">
            Reason (optional, shown in the audit trail only)
          </label>
          <textarea
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
          />
          <div className="flex justify-end">
            <button
              onClick={() => onReject(detail.id, rejectReason.trim() || undefined)}
              className="bg-[#DC2626] text-white rounded-full text-xs font-semibold py-2 px-5 hover:bg-[#DC2626]/90 transition-colors"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      )}

      {/* 2-Column Grid Layout for Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-lg text-[#111827]">Business Info</h3>
          </div>
          <div className="flex flex-col">
            <Row label="Business name" value={detail.name} />
            <Row label="Business Type" value={detail.visitType === "TRAVEL_TO_CUSTOMER" ? "Mobile" : "Premises"} />
            <Row label="Category" value={detail.category} />
            <Row label="Sub Category" value={detail.subcategories.join(", ") || "—"} />
            <Row label="City" value={detail.address.city} />
            <Row
              label="Address"
              value={`${detail.address.streetNumber} ${detail.address.streetName}, ${detail.address.area}`}
              last
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-lg text-[#111827]">Owner Info</h3>
          </div>
          <div className="flex flex-col">
            <Row label="Owner name" value={detail.ownerName} />
            <Row
              label="Email"
              value={
                <a href={`mailto:${detail.owner.email}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                  {detail.owner.email}
                </a>
              }
            />
            <Row
              label="Phone"
              value={
                <a href={`tel:${detail.phone.e164}`} className="text-sm font-medium text-[#2563EB] hover:underline">
                  {detail.phone.e164}
                </a>
              }
              last
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4 lg:col-span-2">
          <div className="pb-3 border-b border-gray-200">
            <h3 className="font-semibold text-lg text-[#111827]">Additional Info</h3>
          </div>
          <div className="flex flex-col">
            <Row label="Brief description" value={detail.briefDescription} last />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, last = false }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex py-3.5 items-start ${last ? "" : "border-b border-gray-200"}`}>
      <span className="w-[180px] sm:w-[260px] text-sm font-medium text-[#6B7280] shrink-0">{label}</span>
      <span className="text-sm font-medium text-[#111827]">{value}</span>
    </div>
  );
}
