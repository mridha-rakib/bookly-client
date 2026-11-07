"use client";

import React from "react";
import { ADVANCE_OPTIONS, NOTICE_OPTIONS } from "@/lib/api/business-availability";

interface LeadTimeSettingsSectionProps {
  allowBookingLead: string;
  setAllowBookingLead: (v: string) => void;
  maxAdvanceBooking: string;
  setMaxAdvanceBooking: (v: string) => void;
}

export default function LeadTimeSettingsSection({
  allowBookingLead,
  setAllowBookingLead,
  maxAdvanceBooking,
  setMaxAdvanceBooking
}: LeadTimeSettingsSectionProps) {
  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      <div className="flex-1 flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111111]">Allow booking <span className="text-[#E24B4A]">*</span></label>
        <select
          value={allowBookingLead}
          onChange={(e) => setAllowBookingLead(e.target.value)}
          className="h-9 w-full bg-white border border-[#D3D1C7] rounded-lg px-2 text-xs font-poppins focus:outline-none cursor-pointer"
        >
          {NOTICE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <label className="text-xs font-semibold text-[#111111]">Add no more than <span className="text-[#E24B4A]">*</span></label>
        <select
          value={maxAdvanceBooking}
          onChange={(e) => setMaxAdvanceBooking(e.target.value)}
          className="h-9 w-full bg-white border border-[#D3D1C7] rounded-lg px-2 text-xs font-poppins focus:outline-none cursor-pointer"
        >
          {ADVANCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
    </div>
  );
}
