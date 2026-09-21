"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, Alert02Icon, ReloadIcon } from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/spinner";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { toUserMessage } from "@/lib/auth/messages";

interface BusinessDashboardApprovalGateProps {
  children: React.ReactNode;
}

/**
 * The single centralized gate for the entire /business-dashboard component tree — the dashboard
 * is one page with tab state, not nested routes, so this is the only place that needs to know
 * about Business.status. RequireBusinessOwner (auth + role) stays unchanged and untouched; this
 * only adds the approval layer on top, and only for this page's own children, so other
 * BUSINESS_OWNER surfaces that reuse RequireBusinessOwner are unaffected.
 *
 * Business.status ("PENDING" | "APPROVED" | "WARNING" | "SUSPENDED") from
 * useMyBusinessProfileQuery is the sole source of truth — no separate approval state, no JWT
 * claim, no localStorage. WARNING is intentionally treated identically to APPROVED (matches the
 * existing backend `requireApprovedBusiness` semantics).
 */
export default function BusinessDashboardApprovalGate({
  children,
}: BusinessDashboardApprovalGateProps) {
  const businessProfileQuery = useMyBusinessProfileQuery();
  const primary = businessProfileQuery.data?.primary ?? null;

  // Fail closed: while status is unknown (first load, or a fetch error, or a BUSINESS_OWNER
  // account somehow missing its Business record) never render the live dashboard underneath.
  if (businessProfileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  if (businessProfileQuery.isError || !primary) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FCFAF9] px-4 text-center font-poppins">
        <p className="max-w-md text-[15px] text-[#111111]">
          {businessProfileQuery.isError
            ? toUserMessage(businessProfileQuery.error)
            : "We couldn't load your business details."}
        </p>
        <button
          type="button"
          onClick={() => void businessProfileQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8EBAC5] px-5 py-2.5 text-sm font-medium text-[#111111] transition-all duration-150 hover:scale-105 active:scale-95"
        >
          <HugeiconsIcon icon={ReloadIcon} className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  const isLocked = primary.status === "PENDING" || primary.status === "SUSPENDED";

  return (
    <div className="relative h-screen overflow-hidden">
      <div
        inert={isLocked}
        aria-hidden={isLocked}
        className={
          isLocked
            ? "pointer-events-none h-full select-none blur-sm brightness-95 md:blur-md"
            : "h-full"
        }
      >
        {children}
      </div>

      {primary.status === "PENDING" && (
        <ApprovalLockOverlay
          onRefresh={() => void businessProfileQuery.refetch()}
          isRefreshing={businessProfileQuery.isFetching}
        />
      )}

      {primary.status === "SUSPENDED" && <SuspendedOverlay />}
    </div>
  );
}

function ApprovalLockOverlay({
  onRefresh,
  isRefreshing,
}: {
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex items-center justify-center bg-black/10 px-4 font-poppins"
    >
      <div className="flex w-full max-w-[480px] flex-col items-center gap-5 rounded-2xl border border-[#F5F5F4] bg-white/95 px-6 py-10 text-center shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] sm:px-10">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[linear-gradient(0deg,rgba(12,192,223,0.2),rgba(12,192,223,0.2)),#8EBAC5]">
          <HugeiconsIcon icon={LockIcon} className="h-8 w-8 text-[#111111]" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-medium leading-[28px] text-[#262626] sm:text-[24px]">
            Your business is awaiting approval
          </h2>
          <p className="text-[14px] leading-[24px] text-black sm:text-[16px]">
            Your registration is complete and your account is active. Your business is currently
            under review — we&apos;ll be in touch within 48 hours. Your dashboard will unlock
            automatically as soon as an administrator approves your business.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-xl bg-[#8EBAC5] px-5 py-2.5 text-sm font-medium text-[#111111] transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        >
          <HugeiconsIcon
            icon={ReloadIcon}
            className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          />
          Check approval status
        </button>
      </div>
    </div>
  );
}

function SuspendedOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex items-center justify-center bg-black/10 px-4 font-poppins"
    >
      <div className="flex w-full max-w-[480px] flex-col items-center gap-5 rounded-2xl border border-[#F5F5F4] bg-white/95 px-6 py-10 text-center shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] sm:px-10">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-rose-50">
          <HugeiconsIcon icon={Alert02Icon} className="h-8 w-8 text-[#E14747]" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] font-medium leading-[28px] text-[#262626] sm:text-[24px]">
            Your business access has been suspended
          </h2>
          <p className="text-[14px] leading-[24px] text-black sm:text-[16px]">
            Your account is still active, but this business is currently suspended and its
            dashboard is unavailable. Please contact support for details.
          </p>
        </div>
      </div>
    </div>
  );
}
