"use client";

import React from "react";
import Image from "next/image";
import { availabilityTableData, TableRow } from "@/data/staffMockData";

export type StaffAvailabilityRow = TableRow;

interface StaffAvailabilityTableProps {
  /** Real rows for the current business. Omit to keep the existing mock-driven behavior
   * (used by the not-yet-wired Staff/Supervisor dashboard variants of this screen). */
  rows?: StaffAvailabilityRow[];
}

export default function StaffAvailabilityTable({ rows }: StaffAvailabilityTableProps) {
  const data = rows ?? availabilityTableData;

  return (
    <div className="w-full bg-white border border-[#E1DED6] rounded-[16px] mb-8">
      {/* Card Header */}
      <div className="border-b border-[#E1DED6] px-6 py-5">
        <h2 className="text-[15px] font-medium font-poppins text-[#0F172B]">Staff Availability & Time Off</h2>
      </div>

      {/* Table Content */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F1F0EA] border-b border-[#E1DED6] text-[#5F605A] uppercase font-semibold text-[13px] tracking-[1.04px]">
              <th className="py-6 px-6 font-poppins">Staff</th>
              <th className="py-6 px-6 font-poppins">Working Days & Shifts</th>
              <th className="py-6 px-6 font-poppins">Time Off</th>
              <th className="py-6 px-6 font-poppins">Services Assigned</th>
              <th className="py-6 px-6 font-poppins">Dashboard Access</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-t border-[#E8E5DE] hover:bg-[#FAFAF9] transition-colors">
                <td className="py-6 px-6 align-top">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm shrink-0 ${row.avatarBg}`}>
                      {row.avatarUrl ? (
                        <Image
                          src={row.avatarUrl}
                          alt={row.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        row.avatarText
                      )}
                    </div>
                    <div className="flex flex-col font-poppins">
                      <span className="text-[#2F312D] font-semibold text-base">{row.name}</span>
                      <span className="text-sm text-[#555751] font-medium mt-0.5">{row.role}</span>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-6 align-top">
                  <div className="flex flex-col gap-1 text-[15px] text-[#343631] font-medium font-poppins">
                    {row.shifts.map((shiftText, shiftIdx) => (
                      <span key={shiftIdx}>{shiftText}</span>
                    ))}
                  </div>
                </td>
                <td className="py-6 px-6 align-top">
                  <span className={`font-semibold text-[15px] font-poppins ${row.timeoff === "None"
                      ? "text-[#4FA17F]"
                      : row.timeoff.includes("Sick")
                        ? "text-[#B64F4B]"
                        : "text-[#9B6A2E]"
                    }`}>
                    {row.timeoff}
                  </span>
                </td>
                <td className="py-6 px-6 align-top text-base text-[#2F312D] font-medium font-poppins">{row.services}</td>
                <td className="py-6 px-6 align-top">
                  <div className="flex flex-col font-poppins">
                    <span className={`font-semibold text-[15px] ${row.role === "Owner"
                        ? "text-[#2F7B65]"
                        : row.role === "Supervisor"
                          ? "text-[#2F5F9F]"
                          : "text-[#3F413D]"
                      }`}>
                      {row.accessTitle}
                    </span>
                    <span className="text-sm text-[#3F413D] font-medium mt-0.5">{row.accessSubtitle}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
