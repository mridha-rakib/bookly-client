"use client";

import React, { useState } from "react";

import {
  useReopenSupportTicketMutation,
  useReplySupportTicketMutation,
  useSupportMessagesQuery,
  useSupportTicketQuery,
} from "@/lib/support/hooks";
import { toUserMessage } from "@/lib/auth/messages";
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

interface RequesterTicketDetailProps {
  ticketId: string;
}

/** Batch 15C — requester-side ticket detail/conversation/reply/reopen, adapted from
 * customer/tickets/view/page.tsx's already-established visual language (chat bubbles, reply box,
 * Reopen button) but hosted as a dashboard-tab pane (no Navbar/Footer/router `?id=` — ticketId is
 * a prop, matching the Bookings/Clients "swap main pane" convention already used in this exact
 * dashboard shell) rather than a new standalone route. Reused by Business Owner/Supervisor/Staff
 * identically — the backend already scopes each role to only their own tickets. */
export default function RequesterTicketDetail({ ticketId }: RequesterTicketDetailProps) {
  const [reply, setReply] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const ticketQuery = useSupportTicketQuery(ticketId);
  const messagesQuery = useSupportMessagesQuery(ticketId, { limit: 100 });
  const replyMutation = useReplySupportTicketMutation();
  const reopenMutation = useReopenSupportTicketMutation();

  const ticket = ticketQuery.data;
  const messages = messagesQuery.data?.messages ?? [];
  const canReply = ticket ? ticket.status === "OPEN" || ticket.status === "PENDING" : false;
  const canReopen = ticket ? ticket.status === "RESOLVED" || ticket.status === "CLOSED" : false;

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setErrorMsg("");
    try {
      await replyMutation.mutateAsync({ ticketId, message: reply });
      setReply("");
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  const handleReopen = async () => {
    setErrorMsg("");
    try {
      await reopenMutation.mutateAsync(ticketId);
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  if (ticketQuery.isLoading) {
    return (
      <div className="w-full md:w-[calc(100%-118px)] ml-0 md:ml-[118px] bg-white border border-[#F1F5F9] rounded-2xl p-8 text-center text-sm text-neutral-500 font-poppins">
        Loading ticket…
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="w-full md:w-[calc(100%-118px)] ml-0 md:ml-[118px] bg-white border border-[#F1F5F9] rounded-2xl p-8 text-center text-sm text-neutral-500 font-poppins">
        Ticket not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full md:w-[calc(100%-118px)] ml-0 md:ml-[118px] gap-5">
      <div className="flex items-center justify-between gap-4 bg-white border border-[#F1F5F9] rounded-2xl p-5">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-mono text-neutral-400">{ticket.reference}</span>
          <h2 className="font-manrope font-semibold text-lg text-[#16123E] truncate">
            {ticket.subject}
          </h2>
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${statusPill(ticket.status)}`}>
          {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
        </span>
      </div>

      <div className="flex flex-col gap-4 bg-white border border-[#F1F5F9] rounded-2xl p-6">
        {messagesQuery.isLoading ? (
          <p className="text-sm text-neutral-500 font-poppins">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-neutral-500 font-poppins">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const fromSupport = message.senderRole === "SUPER_ADMIN";
            return (
              <div
                key={message.id}
                className={`flex flex-col gap-1 max-w-[80%] ${fromSupport ? "self-start" : "self-end items-end"}`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400 font-poppins">
                  {fromSupport ? "Support" : "You"}
                </span>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm font-poppins ${
                    fromSupport ? "bg-neutral-100 text-[#16123E]" : "bg-[#0D0D0D] text-white"
                  }`}
                >
                  {message.message}
                </div>
                <span className="text-[10px] text-neutral-400 font-poppins">
                  {new Date(message.createdAt).toLocaleString("en-GB")}
                </span>
              </div>
            );
          })
        )}
      </div>

      {errorMsg && (
        <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-poppins">
          {errorMsg}
        </div>
      )}

      {canReply ? (
        <form
          onSubmit={handleReply}
          className="flex flex-col bg-white border border-[#F1F5F9] rounded-2xl p-5 gap-3"
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 5000))}
            rows={3}
            placeholder="Write a reply…"
            className="w-full px-4 py-3 bg-white border border-[#B3B3B3] rounded-xl text-sm font-manrope text-neutral-800 placeholder-[#767676] focus:outline-none focus:border-neutral-800 transition-colors resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={replyMutation.isPending || !reply.trim()}
              className="flex justify-center items-center px-4 py-3 gap-2 min-w-[86px] h-12 bg-[#0D0D0D] hover:bg-neutral-800 rounded-xl font-manrope font-medium text-base text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {replyMutation.isPending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </form>
      ) : canReopen ? (
        <div className="flex flex-col items-center gap-3 bg-white border border-[#F1F5F9] rounded-2xl p-6">
          <p className="text-sm text-neutral-500 font-poppins text-center">
            This ticket is {ticket.status.toLowerCase()}. Reopen it to send another message.
          </p>
          <button
            type="button"
            onClick={() => void handleReopen()}
            disabled={reopenMutation.isPending}
            className="py-2.5 px-6 border border-[#5A576B] rounded-xl text-sm font-manrope font-medium text-[#5A576B] hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {reopenMutation.isPending ? "Reopening…" : "Reopen ticket"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
