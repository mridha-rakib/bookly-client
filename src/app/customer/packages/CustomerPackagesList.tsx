"use client";

import React, { useState } from "react";
import type { PackageProgress } from "@/lib/api/packages";
import type { OwnedPackageView } from "@/lib/api/package-views";
import { useMyPackagesQuery, useVoidPackageMutation } from "@/lib/packages/hooks";
import { usePackageView } from "@/lib/packages/view-hooks";
import PackageCard from "./PackageCard";
import FirstClassPackageCard from "@/components/packages/FirstClassPackageCard";
import LegacyPackageRecovery from "@/components/packages/LegacyPackageRecovery";

export type PackageFilterTab = "all" | "active" | "action-required" | "history";

export default function CustomerPackagesList() {
  const [activeFilter, setActiveFilter] = useState<PackageFilterTab>("all");

  // Query legacy packages
  const legacyQuery = useMyPackagesQuery();
  const legacyPackages = legacyQuery.data?.packages ?? [];

  // Query first-class packages
  const firstClassQuery = usePackageView("owned");
  const firstClassPackages = (firstClassQuery.data as { packages: OwnedPackageView[] } | undefined)?.packages ?? [];

  const voidPackageMutation = useVoidPackageMutation();

  const handleRequestRefund = (pkg: PackageProgress) => {
    if (!window.confirm("Refund and cancel this package? This cannot be undone.")) return;

    voidPackageMutation.mutate(
      { businessId: pkg.businessId, packageProgressId: pkg.id },
      {
        onError: () => {
          window.alert(
            "This package could not be refunded — it may already have a used or scheduled session. Please contact the business.",
          );
        },
      },
    );
  };

  const isLoading = legacyQuery.isLoading || firstClassQuery.isPending;
  const isError = legacyQuery.isError || firstClassQuery.isError;

  // Categorization helpers
  const isLegacyActive = (pkg: PackageProgress) =>
    pkg.status === "ACTIVE" && pkg.balanceSettled && pkg.remainingSessions > 0;
  const isLegacyActionRequired = (pkg: PackageProgress) =>
    pkg.status === "AWAITING_BALANCE" ||
    (!pkg.balanceSettled && pkg.status === "ACTIVE") ||
    pkg.voidRefundSettlement?.status === "PENDING";
  const isLegacyHistory = (pkg: PackageProgress) =>
    pkg.status === "VOIDED" ||
    pkg.status === "DEPLETED" ||
    (pkg.remainingSessions === 0 && pkg.sessions.filter((s) => s.status === "SCHEDULED").length === 0);

  const isFirstClassActive = (pkg: OwnedPackageView) =>
    pkg.purchaseCompletion === "VERIFIED" &&
    Boolean(pkg.purchaseFinancials?.balanceSettled) &&
    pkg.items.some((i) => i.remaining > 0) &&
    pkg.status !== "VOIDED" &&
    pkg.status !== "CANCELLED";
  const isFirstClassActionRequired = (pkg: OwnedPackageView) =>
    pkg.purchaseCompletion !== "VERIFIED" ||
    (pkg.purchaseCompletion === "VERIFIED" && Boolean(pkg.purchaseFinancials && !pkg.purchaseFinancials.balanceSettled));
  const isFirstClassHistory = (pkg: OwnedPackageView) =>
    pkg.status === "VOIDED" ||
    pkg.status === "CANCELLED" ||
    pkg.items.every((i) => i.remaining === 0 && i.scheduled === 0);

  // Compute counts
  const allCount = legacyPackages.length + firstClassPackages.length;
  const activeCount =
    legacyPackages.filter(isLegacyActive).length +
    firstClassPackages.filter(isFirstClassActive).length;
  const actionRequiredCount =
    legacyPackages.filter(isLegacyActionRequired).length +
    firstClassPackages.filter(isFirstClassActionRequired).length;
  const historyCount =
    legacyPackages.filter(isLegacyHistory).length +
    firstClassPackages.filter(isFirstClassHistory).length;

  // Filter lists
  const filteredLegacy = legacyPackages.filter((pkg) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return isLegacyActive(pkg);
    if (activeFilter === "action-required") return isLegacyActionRequired(pkg);
    if (activeFilter === "history") return isLegacyHistory(pkg);
    return true;
  });

  const filteredFirstClass = firstClassPackages.filter((pkg) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return isFirstClassActive(pkg);
    if (activeFilter === "action-required") return isFirstClassActionRequired(pkg);
    if (activeFilter === "history") return isFirstClassHistory(pkg);
    return true;
  });

  const filteredTotal = filteredLegacy.length + filteredFirstClass.length;

  return (
    <div className="w-full flex flex-col gap-6 font-manrope">
      <LegacyPackageRecovery />

      {/* Filter Tabs */}
      <div
        role="tablist"
        aria-label="Package status filters"
        className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E2E1E6]"
      >
        <FilterTabButton
          label="All"
          count={isError || isLoading ? null : allCount}
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <FilterTabButton
          label="Active"
          count={isError || isLoading ? null : activeCount}
          active={activeFilter === "active"}
          onClick={() => setActiveFilter("active")}
        />
        <FilterTabButton
          label="Action required"
          count={isError || isLoading ? null : actionRequiredCount}
          active={activeFilter === "action-required"}
          onClick={() => setActiveFilter("action-required")}
        />
        <FilterTabButton
          label="History"
          count={isError || isLoading ? null : historyCount}
          active={activeFilter === "history"}
          onClick={() => setActiveFilter("history")}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-6">
          <PackageCardSkeleton />
          <PackageCardSkeleton />
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div
          role="alert"
          className="w-full rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
        >
          <p className="font-semibold text-red-700">Some packages could not be loaded</p>
          <p className="mt-1 text-sm text-[#5F5E5A]">
            The list may be incomplete. Please retry loading your packages.
          </p>
          <button
            type="button"
            onClick={() => {
              if (legacyQuery.isError) void legacyQuery.refetch();
              if (firstClassQuery.isError) void firstClassQuery.refetch();
            }}
            disabled={legacyQuery.isFetching || firstClassQuery.isFetching}
            className="mt-4 rounded-xl bg-[#0D0D0D] px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors disabled:opacity-50"
          >
            {legacyQuery.isFetching || firstClassQuery.isFetching ? "Retrying…" : "Retry loading"}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && filteredTotal === 0 && (
        <div className="w-full rounded-2xl border border-[#E2E1E6] bg-white py-16 px-6 text-center shadow-sm flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center text-[#45474B] text-xl font-bold">
            📦
          </div>
          <h3 className="font-manrope font-bold text-lg text-[#020305]">
            {activeFilter === "all"
              ? "You have no packages yet"
              : `No ${activeFilter.replace("-", " ")} packages found`}
          </h3>
          <p className="text-sm text-[#5F5E5A] max-w-md">
            {activeFilter === "all"
              ? "When you purchase a multi-session package, it will appear here with session tracking, balances, and scheduling actions."
              : "There are currently no packages matching this status filter."}
          </p>
          {activeFilter !== "all" && (
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className="mt-2 text-sm font-semibold text-[#020305] underline hover:text-[#2E9DA7]"
            >
              View all packages ({allCount})
            </button>
          )}
        </div>
      )}

      {/* Unified 2-Column Responsive Grid */}
      {!isLoading && filteredTotal > 0 && (
        <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {filteredFirstClass.map((pkg) => (
            <FirstClassPackageCard key={`first-class-${pkg.id}`} pkg={pkg} />
          ))}
          {filteredLegacy.map((pkg) => (
            <PackageCard
              key={`legacy-${pkg.id}`}
              pkg={pkg}
              isRefundPending={voidPackageMutation.isPending}
              onRequestRefund={handleRequestRefund}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 py-2 px-3 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
        active
          ? "bg-[#020305] text-white shadow-sm"
          : "text-[#5F5E5A] hover:text-[#020305] hover:bg-neutral-100"
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          active ? "bg-white/20 text-white" : "bg-neutral-200 text-[#45474B]"
        }`}
      >
        {count ?? "—"}
      </span>
    </button>
  );
}

function PackageCardSkeleton() {
  return (
    <div className="w-full bg-white border border-[#E2E1E6] rounded-2xl p-6 shadow-sm flex flex-col gap-5 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-4 w-24 bg-neutral-200 rounded" />
        <div className="h-5 w-20 bg-neutral-200 rounded-full" />
      </div>
      <div className="h-6 w-3/4 bg-neutral-200 rounded" />
      <div className="h-4 w-1/2 bg-neutral-100 rounded" />
      <div className="h-20 w-full bg-neutral-100 rounded-xl" />
      <div className="h-10 w-full bg-neutral-200 rounded-xl mt-auto" />
    </div>
  );
}
