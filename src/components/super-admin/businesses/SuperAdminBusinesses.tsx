"use client";

import React, { useMemo, useRef, useState } from "react";
import { toUserMessage } from "@/lib/auth/messages";
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
  const submitting = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const listParams = {
    ...(activeStatusFilter !== "All" ? { status: activeStatusFilter } : {}),
    ...(selectedCity !== "All" ? { city: selectedCity } : {}),
    ...(selectedType !== "All" ? { visitType: selectedType as BusinessVisitType } : {}),
    ...(selectedCategory !== "All" ? { category: selectedCategory } : {}),
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, isError, isFetching, refetch } = useSuperAdminBusinessesQuery(listParams);
  const approveMutation = useApproveBusinessMutation();
  const suspendMutation = useSuspendBusinessMutation();
  const rejectMutation = useRejectBusinessMutation();

  // Viewing a Pending business needs its detail to decide Review vs. Detail screen — fetched
  // once, up front, rather than duplicating that branch inside each child.
  const viewingQuery = useSuperAdminBusinessDetailQuery(viewingBusinessId ?? undefined);
  const viewingBusiness = viewingQuery.data;

  const categoryOptions = useMemo(() => {
    const categories = new Set((data?.businesses ?? []).map((b) => b.category));
    return Array.from(categories).sort();
  }, [data?.businesses]);

  const handleAction = (action: "approve" | "reject" | "suspend", id: string, reason?: string, close = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setActionError(null);
    const callbacks = {
      onSuccess: () => { if (close) { setViewingBusinessId(null); setInitialDetailTab("Overview"); } },
      onError: (error: Error) => setActionError(toUserMessage(error)),
      onSettled: () => { submitting.current = false; },
    };
    if (action === "approve") approveMutation.mutate(id, callbacks);
    else if (action === "reject") rejectMutation.mutate({ businessId: id, reason }, callbacks);
    else suspendMutation.mutate({ businessId: id, reason }, callbacks);
  };
  const isMutating = approveMutation.isPending || rejectMutation.isPending || suspendMutation.isPending;

  if (viewingBusinessId) {
    if (viewingQuery.isError) return <div role="alert" className="p-8 text-center text-rose-500">Failed to load this business. <button type="button" disabled={viewingQuery.isFetching} onClick={() => void viewingQuery.refetch()} className="underline">Retry</button> <button type="button" onClick={() => setViewingBusinessId(null)} className="underline">Back to businesses</button></div>;
    if (!viewingBusiness) {
      return <div className="p-8 text-center text-gray-400">Loading…</div>;
    }
    if (viewingBusiness.status === "PENDING") {
      return (
        <SuperAdminBusinessReview
          businessId={viewingBusinessId}
          onBack={() => setViewingBusinessId(null)}
          onApprove={(id) => handleAction("approve", id, undefined, true)}
          onReject={(id, reason) => handleAction("reject", id, reason, true)}
          isMutating={isMutating}
          actionError={actionError}
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
        onSuspend={(id) => handleAction("suspend", id, undefined, true)}
        isSuspending={isMutating}
        actionError={actionError}
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

      {data && !isError && <SuperAdminBusinessesTabs
        activeStatusFilter={activeStatusFilter}
        setActiveStatusFilter={(v) => {
          setActiveStatusFilter(v);
          setPage(1);
        }}
        counts={data?.counts ?? { ALL: 0, PENDING: 0, APPROVED: 0, WARNING: 0, SUSPENDED: 0 }}
      />}

      {isError && (
        <div className="p-8 text-center text-rose-500 bg-white rounded-xl border border-gray-100">
          Failed to load businesses. <button type="button" disabled={isFetching} onClick={() => void refetch()} className="underline">Retry</button>
        </div>
      )}

      {isLoading && !data && (
        <div className="p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
          Loading businesses…
        </div>
      )}

      {actionError && <p role="alert" className="text-rose-600">{actionError}</p>}
      {data && !isError && (
        <SuperAdminBusinessesTable
          businesses={data.businesses}
          onView={(id) => setViewingBusinessId(id)}
          onApprove={(id) => handleAction("approve", id)}
          onSuspend={(id) => handleAction("suspend", id)}
          isMutating={isMutating}
          pagination={data.pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
