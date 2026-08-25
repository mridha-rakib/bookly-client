"use client";

import React, { useState } from "react";
import SuperAdminCustomersFilter from "./SuperAdminCustomersFilter";
import SuperAdminCustomersTabs from "./SuperAdminCustomersTabs";
import SuperAdminCustomersTable from "./SuperAdminCustomersTable";
import SuperAdminCustomerDetail from "./SuperAdminCustomerDetail";
import type { CustomerStatus } from "@/lib/api/superAdminCustomers";
import { useSuperAdminCustomersQuery } from "@/lib/superAdminCustomers/hooks";

type StatusFilter = "All" | CustomerStatus;

interface SuperAdminCustomersProps {
  viewingCustomerId?: string | null;
  setViewingCustomerId?: (id: string | null) => void;
}

const PAGE_SIZE = 20;

export default function SuperAdminCustomers({
  viewingCustomerId = null,
  setViewingCustomerId,
}: SuperAdminCustomersProps) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const selectedCustomerId = viewingCustomerId;
  const setSelectedCustomerId = (id: string | null) => setViewingCustomerId?.(id);

  const { data, isLoading, isError } = useSuperAdminCustomersQuery({
    ...(activeStatusFilter !== "All" ? { status: activeStatusFilter } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    page,
    limit: PAGE_SIZE,
  });

  if (selectedCustomerId !== null) {
    return <SuperAdminCustomerDetail customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />;
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">Customers</h2>

        <SuperAdminCustomersFilter
          search={search}
          setSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
        />
      </div>

      <SuperAdminCustomersTabs
        activeStatusFilter={activeStatusFilter}
        setActiveStatusFilter={(v) => {
          setActiveStatusFilter(v);
          setPage(1);
        }}
      />

      {isError && (
        <div className="p-8 text-center text-rose-500 bg-white rounded-xl border border-gray-100">
          Failed to load customers. Please try again.
        </div>
      )}

      {isLoading && !data && (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          Loading customers…
        </div>
      )}

      {data && (
        <SuperAdminCustomersTable
          customers={data.customers}
          onSelectCustomer={setSelectedCustomerId}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
