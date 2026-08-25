"use client";

import React, { Fragment } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface SupportBreadcrumbsProps {
  setActiveTab: (tab: string) => void;
  /** Additional trail segments after "Dashboard" — defaults to the single, non-clickable
   * "Contact Support" segment (original behavior). Batch 15C extends this to support a
   * "Contact Support > My Tickets" / "... > TCK-XXXX" drill-down without changing the default. */
  trail?: BreadcrumbSegment[];
}

export default function SupportBreadcrumbs({
  setActiveTab,
  trail = [{ label: "Contact Support" }],
}: SupportBreadcrumbsProps) {
  return (
    <div className="flex items-center gap-3 select-none flex-wrap">
      <button
        type="button"
        onClick={() => setActiveTab("Dashboard")}
        className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-500 hover:text-neutral-900 font-poppins"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600 shrink-0" />
        <span>Dashboard</span>
      </button>
      {trail.map((segment) => (
        <Fragment key={segment.label}>
          <span className="text-neutral-400 font-poppins text-xs font-semibold select-none">&gt;</span>
          {segment.onClick ? (
            <button
              type="button"
              onClick={segment.onClick}
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 font-poppins cursor-pointer"
            >
              {segment.label}
            </button>
          ) : (
            <span className="text-xs font-semibold text-[#1C1C1A] font-poppins">{segment.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
