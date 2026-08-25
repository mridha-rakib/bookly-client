"use client";

import React from "react";

interface SuperAdminCustomersFilterProps {
  search: string;
  setSearch: (value: string) => void;
}

export default function SuperAdminCustomersFilter({ search, setSearch }: SuperAdminCustomersFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email or phone…"
        className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] w-64"
      />
    </div>
  );
}
