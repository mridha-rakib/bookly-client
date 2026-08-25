"use client";

import React from "react";

interface SuperAdminBookingsFilterProps {
  fromDate: string;
  setFromDate: (date: string) => void;
  toDate: string;
  setToDate: (date: string) => void;
  search: string;
  setSearch: (value: string) => void;
}

export default function SuperAdminBookingsFilter({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  search,
  setSearch,
}: SuperAdminBookingsFilterProps) {
  return (
    <div className="grid grid-cols-1 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] w-full md:flex md:flex-wrap md:items-center">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:flex md:items-center md:w-auto md:gap-3">
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs font-medium text-gray-500 w-8 md:w-auto">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 md:flex-initial md:w-36"
          />
        </div>

        <div className="flex items-center gap-2 w-full">
          <span className="text-xs font-medium text-gray-500 w-8 md:w-auto">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-white border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] cursor-pointer flex-1 md:flex-initial md:w-36"
          />
        </div>
      </div>

      <div className="hidden md:block w-px h-6 bg-gray-200" />

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search reference or customer…"
        className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] w-full md:w-64"
      />
    </div>
  );
}
