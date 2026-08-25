"use client";

import React, { useRef, useState, useEffect } from "react";

import type { SupportTicketStatus } from "@/lib/api/support";
import {
  useSuperAdminChangeSupportStatusMutation,
  useSuperAdminReopenSupportMutation,
  useSuperAdminReplySupportMutation,
  useSuperAdminSupportMessagesQuery,
  useSuperAdminSupportTicketQuery,
  useSuperAdminSupportTicketsQuery,
} from "@/lib/superAdminSupport/hooks";

const PAGE_SIZE = 20;
const MESSAGE_MAX_LENGTH = 5000;

// Regular (non-Reopen) admin-driven transitions — mirrors
// api/src/modules/support/support.types.ts's SUPPORT_STATUS_TRANSITIONS exactly, so the dropdown
// never offers an option the backend would reject.
const REGULAR_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ["PENDING", "RESOLVED"],
  PENDING: ["OPEN", "RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const statusBadgeClasses = (status: SupportTicketStatus) => {
  switch (status) {
    case "OPEN":
      return { dot: "bg-[#2563EB]", text: "text-[#2563EB]", pill: "bg-[#EFF6FF] text-[#2563EB]" };
    case "PENDING":
      return { dot: "bg-[#D97706]", text: "text-[#D97706]", pill: "bg-[#FDF2E9] text-[#D97706]" };
    case "RESOLVED":
      return { dot: "bg-[#16A34A]", text: "text-[#16A34A]", pill: "bg-[#ECFDF5] text-[#16A34A]" };
    case "CLOSED":
      return { dot: "bg-[#DC2626]", text: "text-[#DC2626]", pill: "bg-[#FEF2F2] text-[#DC2626]" };
  }
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const initialsFor = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

export default function SuperAdminSupport() {
  const [activeSubTab, setActiveSubTab] = useState<"All" | SupportTicketStatus>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const filter = activeSubTab === "All" ? {} : { status: activeSubTab };
  const listQuery = useSuperAdminSupportTicketsQuery({
    ...filter,
    q: searchQuery || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const tickets = listQuery.data?.tickets ?? [];
  const total = listQuery.data?.pagination.total ?? 0;

  // Bounded (limit: 1), constant-count status tab badges/stat cards — never N+1 on the ticket list.
  const allCountQuery = useSuperAdminSupportTicketsQuery({ limit: 1 });
  const openCountQuery = useSuperAdminSupportTicketsQuery({ status: "OPEN", limit: 1 });
  const pendingCountQuery = useSuperAdminSupportTicketsQuery({ status: "PENDING", limit: 1 });
  const resolvedCountQuery = useSuperAdminSupportTicketsQuery({ status: "RESOLVED", limit: 1 });
  const closedCountQuery = useSuperAdminSupportTicketsQuery({ status: "CLOSED", limit: 1 });
  const totalCount = allCountQuery.data?.pagination.total ?? 0;
  const openCount = openCountQuery.data?.pagination.total ?? 0;
  const pendingCount = pendingCountQuery.data?.pagination.total ?? 0;
  const resolvedCount = resolvedCountQuery.data?.pagination.total ?? 0;
  const closedCount = closedCountQuery.data?.pagination.total ?? 0;

  const ticketQuery = useSuperAdminSupportTicketQuery(selectedTicketId ?? undefined);
  const messagesQuery = useSuperAdminSupportMessagesQuery(selectedTicketId ?? undefined, {
    limit: 100,
  });
  const ticket = ticketQuery.data;
  const messages = messagesQuery.data?.messages ?? [];

  const replyMutation = useSuperAdminReplySupportMutation();
  const statusMutation = useSuperAdminChangeSupportStatusMutation();
  const reopenMutation = useSuperAdminReopenSupportMutation();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicketId, messages.length]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicketId) return;
    setActionError(undefined);
    try {
      await replyMutation.mutateAsync({ ticketId: selectedTicketId, message: replyText });
      setReplyText("");
    } catch {
      setActionError("Could not send the reply. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendReply();
    }
  };

  const handleChangeStatus = async (status: SupportTicketStatus) => {
    if (!selectedTicketId) return;
    setActionError(undefined);
    try {
      await statusMutation.mutateAsync({ ticketId: selectedTicketId, status });
    } catch {
      setActionError("Could not update the ticket status.");
    }
  };

  const handleReopen = async () => {
    if (!selectedTicketId) return;
    setActionError(undefined);
    try {
      await reopenMutation.mutateAsync(selectedTicketId);
    } catch {
      setActionError("Could not reopen the ticket.");
    }
  };

  const canReply = ticket ? ticket.status === "OPEN" || ticket.status === "PENDING" : false;
  const canReopen = ticket ? ticket.status === "RESOLVED" || ticket.status === "CLOSED" : false;

  if (selectedTicketId) {
    const badge = ticket ? statusBadgeClasses(ticket.status) : undefined;
    const lastMessage = messages.at(-1);

    return (
      <div className="flex flex-col bg-white h-full w-full border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {/* Chat top header container */}
        <div className="flex flex-row justify-between items-center px-3 md:px-6 py-2.5 md:h-16 bg-white border-b border-[#E5E7EB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] w-full gap-2 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button
              onClick={() => {
                setSelectedTicketId(null);
                setActionError(undefined);
              }}
              className="flex flex-row items-center gap-1 px-1.5 py-1 hover:bg-gray-55 rounded-lg transition-colors border-none text-[#6B7280] shrink-0"
            >
              <svg className="w-4 h-4 stroke-[#6B7280]" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-sans font-medium text-xs leading-4 hidden sm:inline">Back</span>
            </button>

            <div className="h-5 w-[1px] bg-gray-200" />

            {ticket && badge && (
              <div className="flex items-center gap-1.5 md:gap-3 min-w-0">
                <div className="flex justify-center items-center w-8 h-8 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full shrink-0 font-sans font-bold text-xs text-[#374151] select-none">
                  {initialsFor(ticket.requesterDisplayName)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-sans font-semibold text-xs md:text-sm text-[#111827] leading-[15px] truncate">
                    {ticket.requesterDisplayName}
                  </span>
                  <span className="font-sans font-normal text-[10px] md:text-xs text-[#6B7280] leading-[12px] mt-0.5 font-mono">
                    {ticket.reference}
                  </span>
                </div>

                <div className="flex items-center h-4.5 bg-blue-55/10 rounded-full px-2 gap-1 relative shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                  <span className={`font-sans font-semibold text-[10px] leading-[12px] ${badge.text}`}>
                    {ticket.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {ticket && (
            <div className="flex flex-row items-center gap-1.5 shrink-0">
              {REGULAR_TRANSITIONS[ticket.status].length > 0 && (
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) void handleChangeStatus(e.target.value as SupportTicketStatus);
                    }}
                    disabled={statusMutation.isPending}
                    className="appearance-none bg-white border border-[#111111]/30 rounded-xl px-2.5 py-1 pr-7 text-xs font-medium text-[#111111]/60 focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] shadow-[0px_1px_2px_rgba(0,0,0,0.02)] cursor-pointer disabled:opacity-50"
                  >
                    <option value="" disabled>
                      Change status…
                    </option>
                    {REGULAR_TRANSITIONS[ticket.status].map((target) => (
                      <option key={target} value={target}>
                        {target.charAt(0) + target.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#111111]/60">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              {canReopen && (
                <button
                  onClick={() => void handleReopen()}
                  disabled={reopenMutation.isPending}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2E9DA7] text-white text-xs font-medium rounded-full hover:opacity-90 transition-colors border-none shrink-0 disabled:opacity-50"
                >
                  {reopenMutation.isPending ? "Reopening…" : "Reopen"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Workspace Split (Left sidebar detail panel, Right chat conversation) */}
        <div className="flex flex-row flex-grow w-full min-h-0">
          {/* Left Details Panel (300px) */}
          <div className="hidden lg:flex lg:w-[300px] lg:border-r border-[#E5E7EB] bg-white flex-col shrink-0 lg:overflow-y-auto">
            {ticketQuery.isLoading || !ticket ? (
              <div className="p-5 text-sm text-[#6B7280]">Loading ticket…</div>
            ) : (
              <>
                <div className="p-5 border-b border-[#E5E7EB] flex flex-col gap-4">
                  <span className="font-sans font-semibold text-[11px] leading-[13px] tracking-[0.66px] uppercase text-[#6B7280]">
                    Ticket
                  </span>
                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Reference</span>
                      <span className="font-semibold text-[#111827] font-mono">{ticket.reference}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Created</span>
                      <span className="font-semibold text-[#111827]">{formatDateTime(ticket.createdAt)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Last reply</span>
                      <span className="font-semibold text-[#111827]">
                        {lastMessage ? formatDateTime(lastMessage.createdAt) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B7280]">Messages</span>
                      <span className="font-semibold text-[#111827]">{messages.length} messages</span>
                    </div>
                    {ticket.bookingReference && (
                      <div className="flex justify-between items-center">
                        <span className="text-[#6B7280]">Booking</span>
                        <span className="font-semibold text-[#111827] font-mono">
                          {ticket.bookingReference}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 border-b border-[#E5E7EB] flex flex-col gap-4">
                  <span className="font-sans font-semibold text-[11px] leading-[13px] tracking-[0.66px] uppercase text-[#6B7280]">
                    Requester
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex justify-center items-center w-10 h-10 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full shrink-0 font-sans font-bold text-sm text-[#374151] select-none">
                      {initialsFor(ticket.requesterDisplayName)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans font-semibold text-sm text-[#111827] leading-[17px] truncate">
                        {ticket.requesterDisplayName}
                      </span>
                      <span className="font-sans font-normal text-xs text-[#6B7280] leading-[15px] mt-0.5">
                        {ticket.requesterRole.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 text-xs pt-1">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[#6B7280] shrink-0">Email</span>
                      <span
                        className="font-semibold text-[#111827] truncate max-w-[170px]"
                        title={ticket.requesterEmail}
                      >
                        {ticket.requesterEmail}
                      </span>
                    </div>
                    {ticket.businessName && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[#6B7280] shrink-0">Business</span>
                        <span
                          className="font-semibold text-[#111827] truncate max-w-[170px]"
                          title={ticket.businessName}
                        >
                          {ticket.businessName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Conversation & Reply box */}
          <div className="flex flex-col flex-grow bg-[#F9FAFB] min-h-0">
            <div
              className="flex-grow p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {messagesQuery.isLoading ? (
                <p className="text-sm text-[#6B7280]">Loading conversation…</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No messages yet.</p>
              ) : (
                messages.map((msg, idx) => {
                  const isRequester = msg.senderRole !== "SUPER_ADMIN";
                  const currentDate = new Date(msg.createdAt).toDateString();
                  const previousDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : null;
                  const showDateLabel = currentDate !== previousDate;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDateLabel && (
                        <div className="relative w-full flex items-center justify-center my-2 select-none">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-[#E5E7EB]" />
                          </div>
                          <span className="relative px-3 bg-[#F9FAFB] font-sans font-medium text-xs text-[#6B7280]">
                            {new Date(msg.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}

                      <div className={`flex items-end gap-3 w-full ${isRequester ? "justify-start" : "justify-end"}`}>
                        {isRequester && ticket && (
                          <div className="flex justify-center items-center w-8 h-8 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full font-bold text-xs text-[#374151] select-none shrink-0">
                            {initialsFor(ticket.requesterDisplayName)}
                          </div>
                        )}

                        <div className={`flex flex-col gap-1.5 max-w-[85%] ${isRequester ? "items-start" : "items-end"}`}>
                          <span className="font-sans font-semibold text-[11px] text-[#6B7280]">
                            {isRequester ? (ticket?.requesterDisplayName ?? "Requester") : "Support"}
                          </span>

                          <div
                            className={`p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] border border-[#E5E7EB] ${
                              isRequester
                                ? "bg-white text-[#111827] rounded-tr-[16px] rounded-br-[16px] rounded-bl-[16px] rounded-tl-[4px]"
                                : "bg-[#6366F1] text-white border-transparent rounded-tl-[16px] rounded-bl-[16px] rounded-br-[16px] rounded-tr-[4px]"
                            }`}
                          >
                            <p className="font-sans font-normal text-sm leading-[22px] whitespace-pre-line">
                              {msg.message}
                            </p>
                          </div>

                          <span className="font-sans font-normal text-[11px] text-[#6B7280]">
                            {new Date(msg.createdAt).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {!isRequester && (
                          <div className="flex justify-center items-center w-8 h-8 bg-[#EEF2FF] rounded-full font-bold text-xs text-[#4338CA] select-none shrink-0">
                            SA
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {actionError && (
              <div className="mx-8 mb-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                {actionError}
              </div>
            )}

            {/* Bottom Text Area container */}
            <div className="p-4 px-8 border-t border-[#E5E7EB] bg-white flex flex-col gap-3 shrink-0">
              {canReply ? (
                <div className="flex flex-col bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl overflow-hidden w-full">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a reply…"
                    className="w-full h-[72px] px-4 py-3 bg-transparent text-sm text-[#111827] placeholder-[#6B7280] border-none resize-none focus:outline-none focus:ring-0 font-sans"
                  />

                  <div className="flex justify-between items-center px-3.5 pb-2.5">
                    <span className="font-sans font-normal text-xs text-[#6B7280]">
                      {replyText.length} / {MESSAGE_MAX_LENGTH}
                    </span>
                    <button
                      onClick={() => void handleSendReply()}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold text-white border-none transition-all ${
                        replyText.trim() && !replyMutation.isPending
                          ? "bg-[#6366F1] cursor-pointer hover:bg-[#5053D4]"
                          : "bg-gray-300 cursor-not-allowed"
                      }`}
                    >
                      <span>{replyMutation.isPending ? "Sending…" : "Send Reply"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#6B7280] text-center py-2">
                  This ticket is {ticket?.status.toLowerCase()}. Reopen it to send another reply.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Upper header section */}
      <div className="flex flex-col gap-1">
        <h1 className="font-sans font-semibold text-2xl text-[#111827] tracking-tight">Support</h1>
        <p className="font-sans text-sm text-[#4E5F78]">
          Manage incoming messages from customers and businesses.
        </p>
      </div>

      {/* 4 Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col justify-between min-h-[108px] transition-all hover:shadow-md">
          <span className="text-[13px] font-medium text-gray-500">Total Tickets</span>
          <span className="text-3xl font-bold text-[#111827] mt-2 mb-1">{totalCount}</span>
          <span className="text-xs text-gray-400 font-normal">All time</span>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 border-l-[2.4px] border-l-[#2563EB] flex flex-col justify-between min-h-[108px] transition-all hover:shadow-md">
          <span className="text-[13px] font-medium text-gray-500">Open</span>
          <span className="text-3xl font-bold text-[#2563EB] mt-2 mb-1">{openCount}</span>
          <span className="text-xs text-gray-400 font-normal">Awaiting reply</span>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 border-l-[2.4px] border-l-[#D97706] flex flex-col justify-between min-h-[108px] transition-all hover:shadow-md">
          <span className="text-[13px] font-medium text-gray-500">Pending</span>
          <span className="text-3xl font-bold text-[#D97706] mt-2 mb-1">{pendingCount}</span>
          <span className="text-xs text-gray-400 font-normal">Waiting on user</span>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 border-l-[2.4px] border-l-[#16A34A] flex flex-col justify-between min-h-[108px] transition-all hover:shadow-md">
          <span className="text-[13px] font-medium text-gray-500">Resolved</span>
          <span className="text-3xl font-bold text-[#16A34A] mt-2 mb-1">{resolvedCount}</span>
          <span className="text-xs text-gray-400 font-normal">All time</span>
        </div>
      </div>

      {/* Subtabs and Search filter row */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center gap-4 border-b border-gray-200 pb-px overflow-x-auto">
          {(["All", "OPEN", "PENDING", "RESOLVED", "CLOSED"] as const).map((tab) => {
            const isActive = activeSubTab === tab;
            const countMap: Record<typeof tab, number> = {
              All: totalCount,
              OPEN: openCount,
              PENDING: pendingCount,
              RESOLVED: resolvedCount,
              CLOSED: closedCount,
            };

            let badgeBg = "bg-[#6B7280]";
            if (tab === "OPEN") badgeBg = "bg-[#2563EB]";
            else if (tab === "PENDING") badgeBg = "bg-[#D97706]";
            else if (tab === "RESOLVED") badgeBg = "bg-[#16A34A]";
            else if (tab === "CLOSED") badgeBg = "bg-[#DC2626]";

            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveSubTab(tab);
                  setPage(1);
                }}
                className={`pb-2.5 px-4 text-sm font-medium whitespace-nowrap transition-all border-b-2 flex items-center gap-2 ${
                  isActive ? "border-[#6366F1] text-[#4338CA] font-semibold" : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                <span>{tab === "All" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white transition-colors ${badgeBg}`}>
                  {countMap[tab]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-grow max-w-md">
          <input
            type="text"
            placeholder="Search by reference or subject"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#2E9DA7] focus:border-[#2E9DA7] shadow-[0px_1px_2px_rgba(0,0,0,0.02)]"
          />
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Tickets Table Panel */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-200 overflow-hidden flex flex-col w-full">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 bg-gray-50/50">
                <th className="py-3 px-6 text-left">Subject</th>
                <th className="py-3 px-6 text-left">From</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-left">Created</th>
                <th className="py-3 px-6 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-normal">
                    Loading tickets…
                  </td>
                </tr>
              ) : tickets.length > 0 ? (
                tickets.map((row) => {
                  const badge = statusBadgeClasses(row.status);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedTicketId(row.id)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-6 max-w-[340px]">
                        <div className="font-semibold text-gray-900 truncate">{row.subject}</div>
                        <div className="text-xs text-gray-500 truncate mt-1 font-mono">{row.reference}</div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-700 shrink-0 select-none">
                            {initialsFor(row.requesterDisplayName)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-gray-900 truncate">{row.requesterDisplayName}</span>
                            <span className="text-xs text-gray-400 font-normal">
                              {row.businessName ?? row.requesterRole.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${badge.pill}`}>
                          {row.status.charAt(0) + row.status.slice(1).toLowerCase()}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-gray-600 font-normal">
                        {new Date(row.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedTicketId(row.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-[#2E9DA7] text-sm font-semibold rounded-full bg-[#2E9DA7]/10 text-[#2E9DA7] hover:bg-[#2E9DA7]/20 transition-colors"
                          >
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-normal">
                    No tickets match the search query and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 py-4 px-6">
          <span className="text-xs text-gray-500">
            Showing {tickets.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + tickets.length} of{" "}
            {total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <button
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
