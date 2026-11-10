"use client";

import React from "react";
import { SUPPORT_TICKET_STATUSES } from "@/lib/api/support";

export default function CustomerTicketFilters({
  search,
  status,
  onSearch,
  onStatus,
  onClearSearch,
  onClear,
}: {
  search: string;
  status?: string;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onClearSearch: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2 text-sm font-medium text-[#45474B]">
        <label htmlFor="customer-ticket-search">Search tickets</label>
        <div className="flex items-center gap-2 rounded-lg border border-[#C6C6CB] bg-white px-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-5 w-5 shrink-0"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            id="customer-ticket-search"
            type="search"
            value={search}
            maxLength={100}
            placeholder="Search by subject or ticket reference"
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClearSearch();
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={onClearSearch}
              className="px-2 py-2"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <label className="flex flex-col gap-2 text-sm font-medium text-[#45474B]">
        Ticket status
        <select
          value={status ?? ""}
          onChange={(event) => onStatus(event.target.value)}
          className="h-12 rounded-lg border border-[#C6C6CB] bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {SUPPORT_TICKET_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onClear}
        className="h-12 rounded-lg border border-[#C6C6CB] px-4 text-sm font-semibold"
      >
        Clear filters
      </button>
    </div>
  );
}
