"use client";

import React, { useMemo, useState } from "react";
import SuperAdminBusinessesFilter from "./SuperAdminBusinessesFilter";
import SuperAdminBusinessesTabs from "./SuperAdminBusinessesTabs";
import SuperAdminBusinessesTable from "./SuperAdminBusinessesTable";
import SuperAdminBusinessReview from "./SuperAdminBusinessReview";
import SuperAdminBusinessDetail from "./business-detail/SuperAdminBusinessDetail";
import type { BusinessStatus, BusinessVisitType } from "@/lib/api/superAdminBusiness";
import {
  useApproveBusinessMutation,
  useRejectBusinessMutation,
  useSuperAdminBusinessDetailQuery,
  useSuperAdminBusinessesQuery,
  useSuspendBusinessMutation,
} from "@/lib/superAdminBusiness/hooks";

type StatusFilter = "All" | BusinessStatus;

interface SuperAdminBusinessesProps {
  viewingBusinessId?: string | null;
  setViewingBusinessId?: (id: string | null) => void;
  initialDetailTab?: string;
  setInitialDetailTab?: (tab: string) => void;
}

const PAGE_SIZE = 20;

export default function SuperAdminBusinesses({
  viewingBusinessId = null,
  setViewingBusinessId = () => {},
  initialDetailTab = "Overview",
  setInitialDetailTab = () => {},
}: SuperAdminBusinessesProps) {
  const [activeStatusFilter, setActiveStatusFilter] = useState<StatusFilter>("All");
  const [selectedCity, setSelectedCity] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [page, setPage] = useState(1);

  const listParams = {
    ...(activeStatusFilter !== "All" ? { status: activeStatusFilter } : {}),
    ...(selectedCity !== "All" ? { city: selectedCity } : {}),
    ...(selectedType !== "All" ? { visitType: selectedType as BusinessVisitType } : {}),
    ...(selectedCategory !== "All" ? { category: selectedCategory } : {}),
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isError } = useSuperAdminBusinessesQuery(listParams);
  const approveMutation = useApproveBusinessMutation();
  const suspendMutation = useSuspendBusinessMutation();
  const rejectMutation = useRejectBusinessMutation();

  // Viewing a Pending business needs its detail to decide Review vs. Detail screen — fetched
  // once, up front, rather than duplicating that branch inside each child.
  const { data: viewingBusiness } = useSuperAdminBusinessDetailQuery(viewingBusinessId ?? undefined);

  const categoryOptions = useMemo(() => {
    const categories = new Set((data?.businesses ?? []).map((b) => b.category));
    return Array.from(categories).sort();
  }, [data?.businesses]);

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleSuspend = (id: string) => {
    suspendMutation.mutate({ businessId: id });
  };

  if (viewingBusinessId) {
    if (!viewingBusiness) {
      return <div className="p-8 text-center text-gray-400">Loading…</div>;
    }
    if (viewingBusiness.status === "PENDING") {
      return (
        <SuperAdminBusinessReview
          businessId={viewingBusinessId}
          onBack={() => setViewingBusinessId(null)}
          onApprove={(id) => {
            handleApprove(id);
            setViewingBusinessId(null);
          }}
          onReject={(id, reason) => {
            rejectMutation.mutate({ businessId: id, reason });
            setViewingBusinessId(null);
          }}
        />
      );
    }
    return (
      <SuperAdminBusinessDetail
        businessId={viewingBusinessId}
        initialTab={initialDetailTab}
        onBack={() => {
          setViewingBusinessId(null);
          setInitialDetailTab("Overview");
        }}
        onSuspend={(id) => {
          handleSuspend(id);
          setViewingBusinessId(null);
          setInitialDetailTab("Overview");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
        <h2 className="font-sans font-semibold text-2xl text-[#111827] leading-[32px]">Business</h2>

        <SuperAdminBusinessesFilter
          selectedCity={selectedCity}
          setSelectedCity={(v) => {
            setSelectedCity(v);
            setPage(1);
          }}
          selectedType={selectedType}
          setSelectedType={(v) => {
            setSelectedType(v);
            setPage(1);
          }}
          selectedCategory={selectedCategory}
          setSelectedCategory={(v) => {
            setSelectedCategory(v);
            setPage(1);
          }}
          categoryOptions={categoryOptions}
        />
      </div>

      <SuperAdminBusinessesTabs
        activeStatusFilter={activeStatusFilter}
        setActiveStatusFilter={(v) => {
          setActiveStatusFilter(v);
          setPage(1);
        }}
        counts={data?.counts ?? { ALL: 0, PENDING: 0, APPROVED: 0, WARNING: 0, SUSPENDED: 0 }}
      />

      {isError && (
        <div className="p-8 text-center text-rose-500 bg-white rounded-xl border border-gray-100">
          Failed to load businesses. Please try again.
        </div>
      )}

      {isLoading && !data && (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          Loading businesses…
        </div>
      )}

      {data && (
        <SuperAdminBusinessesTable
          businesses={data.businesses}
          onView={(id) => setViewingBusinessId(id)}
          onApprove={handleApprove}
          onSuspend={handleSuspend}
          isMutating={approveMutation.isPending || suspendMutation.isPending}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
