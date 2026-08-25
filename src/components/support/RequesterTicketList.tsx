"use client";

import React from "react";

import { useSupportTicketsQuery } from "@/lib/support/hooks";
import type { SupportTicketStatus } from "@/lib/api/support";

const statusPill = (status: SupportTicketStatus) => {
  switch (status) {
    case "OPEN":
      return "bg-[#E6F4EA] text-[#137333]";
    case "PENDING":
      return "bg-[#FFF4E5] text-[#B5651D]";
    case "RESOLVED":
      return "bg-[#E8F0FE] text-[#1A73E8]";
    case "CLOSED":
      return "bg-neutral-100 text-neutral-500";
  }
};

const PAGE_SIZE = 10;

interface RequesterTicketListProps {
  onSelectTicket: (ticketId: string) => void;
}

/** Batch 15C — the requester-side ticket list shared by Business Owner/Supervisor/Staff (and
 * available for the same reuse by Customer where relevant), hosted inside the existing "Contact
 * Support" tab rather than a new page/nav item. Visual language matches ContactSupport.tsx's own
 * existing card/button styling (font-manrope, #B3B3B3 borders, #0D0D0D primary buttons) — not the
 * Customer standalone page's styling, since this lives inside the dashboard shell. */
export default function RequesterTicketList({ onSelectTicket }: RequesterTicketListProps) {
  const [page, setPage] = React.useState(1);
  const ticketsQuery = useSupportTicketsQuery({ page, limit: PAGE_SIZE });
  const tickets = ticketsQuery.data?.tickets ?? [];
  const total = ticketsQuery.data?.pagination.total ?? 0;

  return (
    <div className="flex flex-col w-full md:w-[calc(100%-118px)] bg-white border border-[#F1F5F9] rounded-2xl shadow-sm overflow-hidden ml-0 md:ml-[118px]">
      <div className="flex flex-col divide-y divide-[#F1F5F9]">
        {ticketsQuery.isLoading ? (
          <p className="p-8 text-sm text-neutral-500 font-poppins text-center">
            Loading your tickets…
          </p>
        ) : ticketsQuery.isError ? (
          <p className="p-8 text-sm text-neutral-500 font-poppins text-center">
            Your tickets could not be loaded right now.
          </p>
        ) : tickets.length === 0 ? (
          <p className="p-8 text-sm text-neutral-500 font-poppins text-center">
            You haven&apos;t submitted any support requests yet.
          </p>
        ) : (
          tickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => onSelectTicket(ticket.id)}
              className="flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-neutral-50 transition-colors cursor-pointer w-full"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-mono text-neutral-400">{ticket.reference}</span>
                <span className="font-manrope font-semibold text-sm text-[#16123E] truncate">
                  {ticket.subject}
                </span>
                <span className="text-xs text-neutral-400 font-poppins">
                  {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <span
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusPill(ticket.status)}`}
              >
                {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
              </span>
            </button>
          ))
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#F1F5F9]">
          <span className="text-xs text-neutral-400 font-poppins">
            Showing {tickets.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {(page - 1) * PAGE_SIZE + tickets.length} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-[#B3B3B3] rounded-lg text-xs font-semibold text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-[#B3B3B3] rounded-lg text-xs font-semibold text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
