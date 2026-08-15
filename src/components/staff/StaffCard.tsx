"use client";

import React from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Staff } from "@/data/staffMockData";

interface StaffCardProps {
  staff: Staff;
  onToggleStatus: (id: number | string) => void;
  onEdit: (id: number | string) => void;
  canEdit?: boolean;
}

export default function StaffCard({ staff, onToggleStatus, onEdit, canEdit = true }: StaffCardProps) {
  return (
    <div
      className="box-sizing-border-box bg-white border border-[#E2E8F0] rounded-[14px] p-6 flex flex-col items-center text-center shadow-[0px_1px_3px_rgba(0,0,0,0.1),_0px_1px_2px_-1px_rgba(0,0,0,0.1)] w-full max-w-[352.33px] min-h-[251.5px] relative"
    >
      {/* Toggle switch: placed absolutely at top right */}
      <div className="absolute right-6 top-6">
        <button
          type="button"
          disabled={staff.role === "Owner" || !canEdit}
          onClick={() => onToggleStatus(staff.id)}
          className={`w-[38px] h-[21px] rounded-full p-[3px] transition-colors duration-200 focus:outline-none flex items-center ${
            staff.status === "Active" ? "bg-[#0F6E56]" : "bg-neutral-300"
          } ${staff.role === "Owner" || !canEdit ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
        >
          <div
            className={`w-[15px] h-[15px] bg-white rounded-full transition-transform duration-200 ${
              staff.status === "Active" ? "translate-x-[17px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Avatar circle */}
      <div className="flex flex-col items-center pb-4">
        <div
          className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-lg ${
            staff.role === "Owner"
              ? "bg-[#7C3AED]"
              : staff.role === "Supervisor"
              ? "bg-[#EC4899]"
              : "bg-[#10B981]"
          }`}
        >
          {staff.avatarUrl ? (
            <Image
              src={staff.avatarUrl}
              alt={staff.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          ) : (
            staff.avatarText
          )}
        </div>
      </div>

      {/* Content info centered */}
      <div className="flex flex-col items-center pb-1 select-none">
        <h3 className="font-poppins font-medium text-[15px] leading-[22px] text-[#0F172B]">
          {staff.name}
        </h3>
      </div>

      {/* Role */}
      <div className="flex flex-col items-center pb-1">
        <p className="font-poppins font-normal text-xs leading-[20px] text-[#62748E]">
          {staff.subRole}
        </p>
      </div>

      {/* Assigned services */}
      <div className="flex flex-col items-center pb-1">
        <p className="font-poppins font-medium text-xs leading-[20px] text-[#BB4D00]">
          {staff.servicesAssigned}
        </p>
      </div>

      {/* Schedule */}
      <div className="flex flex-col items-center pb-4">
        <p className="font-poppins font-normal text-[11px] leading-[18px] text-[#90A1B9]">
          {staff.schedule}
        </p>
      </div>

      {/* Footer badges row */}
      <div className="flex flex-row items-center gap-2 h-6">
        {/* Active badge */}
        <div
          className={`flex flex-row justify-center items-center px-2 py-1 h-6 rounded-full text-[11px] font-medium ${
            staff.status === "Active"
              ? "bg-[#ECFDF5] text-[#009966]"
              : "bg-[#FFF5F5] text-[#DE350B]"
          }`}
        >
          <span>{staff.status}</span>
        </div>

        {/* Role badge */}
        <div className={`flex flex-row justify-center items-center px-2.5 py-1 h-6 rounded-full text-[11px] font-medium ${
          (staff.cardRoleText || staff.role) === "Owner" ? "bg-[#E0F3F5] text-[#2E9DA7]" :
          (staff.cardRoleText || staff.role) === "Supervisor" ? "bg-[#E6F1FB] text-[#3760B7]" :
          "bg-[#F5F4EE] text-[#5F5E5A]"
        }`}>
          <span>{staff.cardRoleText || staff.role}</span>
        </div>

        {/* Edit button */}
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(staff.id)}
            className="flex flex-row items-center justify-center px-3 py-1 gap-1 h-6 bg-[#111111] hover:bg-black text-white rounded-full text-[11px] font-medium transition-all cursor-pointer"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} className="w-3 h-3 text-white" />
            <span>Edit</span>
          </button>
        )}
      </div>
    </div>
  );
}
