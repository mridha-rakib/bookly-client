"use client";

import React from "react";

interface SuperAdminOverviewErrorProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}

/** P1.9 (G6) — a failed Overview read is shown as a failure with Retry, never as an endless
 * skeleton or as zero-valued KPIs. */
export default function SuperAdminOverviewError({ message, retrying, onRetry }: SuperAdminOverviewErrorProps) {
  return (
    <div
      role="alert"
      className="bg-white rounded-xl p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full"
    >
      <span className="font-sans text-sm text-rose-600">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="self-start sm:self-auto rounded-lg px-4 py-1.5 text-[13px] font-medium bg-white text-[#314158] border border-[#E2E8F0] hover:bg-gray-50 disabled:opacity-50"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
