"use client";

import React from "react";

import type { DashboardOverview, OverviewRange } from "@/lib/api/dashboardOverview";
import { BooklyApiError } from "@/lib/api/client";
import { toUserMessage } from "@/lib/auth/messages";

export type OverviewViewState = "loading" | "ready" | "error" | "unavailable";

type QueryLike = {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
};

/** One state machine for the Staff/Supervisor Overview. Missing data is never presented as zero:
 * metric cards show "—" unless the state is "ready". A 403/404 from either read means the actor
 * has no current Business access (inactive/removed membership or another Business). */
export const resolveOverviewViewState = (
  currentUser: QueryLike & { data?: { business?: { id: string } | null } | undefined },
  overview: QueryLike,
): OverviewViewState => {
  const denied = (error: unknown) => error instanceof BooklyApiError && (error.status === 403 || error.status === 404);
  if (currentUser.isError) return denied(currentUser.error) ? "unavailable" : "error";
  if (currentUser.isPending) return "loading";
  if (!currentUser.data?.business?.id) return "unavailable";
  if (overview.isError) return denied(overview.error) ? "unavailable" : "error";
  if (overview.data === undefined) return "loading";
  return "ready";
};

interface OverviewRequestStateProps {
  state: OverviewViewState;
  range: OverviewRange;
  overview: DashboardOverview | undefined;
  failedQuery: QueryLike | null;
}

export default function OverviewRequestState({ state, range, overview, failedQuery }: OverviewRequestStateProps) {
  if (state === "loading") {
    return <p role="status" className="text-xs text-neutral-500 font-poppins">Loading overview…</p>;
  }
  if (state === "unavailable") {
    return (
      <p role="alert" className="text-xs text-[#5F5E5A] font-poppins">
        Overview is unavailable: your account has no active employment with this Business.
      </p>
    );
  }
  if (state === "error") {
    const retrying = Boolean(failedQuery?.isFetching);
    return (
      <p role="alert" className="text-xs text-red-600 font-poppins">
        The overview could not be loaded. {failedQuery ? toUserMessage(failedQuery.error) : null}{" "}
        <button
          type="button"
          disabled={retrying}
          onClick={() => void failedQuery?.refetch()}
          className="underline font-semibold disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      </p>
    );
  }
  return (
    <p className="text-xs text-neutral-500 font-poppins">
      Selected range: {overview?.period ? `${overview.period.fromDate} – ${overview.period.toDate} (${overview.period.timezone})` : range.range}.
      {" "}Schedule displays up to {overview?.period?.scheduleLimit ?? 200} records; totals cover the complete range.
    </p>
  );
}
