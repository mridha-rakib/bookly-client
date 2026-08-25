"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import { useAuthStore } from "@/lib/auth/store";
import {
  useReopenSupportTicketMutation,
  useReplySupportTicketMutation,
  useSupportMessagesQuery,
  useSupportTicketQuery,
} from "@/lib/support/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import type { SupportTicketStatus } from "@/lib/api/support";

const statusBadge = (status: SupportTicketStatus) => {
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

function TicketViewContent() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("id") ?? undefined;

  const authUser = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const isLoggedIn = authStatus === "authenticated" && authUser?.role === "CUSTOMER";

  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
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
    if (!ticketId || !reply.trim()) return;
    setErrorMsg("");
    try {
      await replyMutation.mutateAsync({ ticketId, message: reply });
      setReply("");
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  const handleReopen = async () => {
    if (!ticketId) return;
    setErrorMsg("");
    try {
      await reopenMutation.mutateAsync(ticketId);
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={() => {}}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center py-12">
        <div className="max-w-[760px] w-full flex flex-col items-start gap-6 pb-20">
          <Link href="/customer/tickets" className="text-sm text-[#767676] hover:text-black">
            ← Back to My Tickets
          </Link>

          {ticketQuery.isLoading ? (
            <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl">
              <p className="text-[#45474B] text-lg font-medium">Loading ticket…</p>
            </div>
          ) : !ticket ? (
            <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl">
              <p className="text-[#45474B] text-lg font-medium">Ticket not found.</p>
            </div>
          ) : (
            <>
              <div className="w-full flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-mono text-[#767676]">{ticket.reference}</span>
                  <h1 className="font-manrope font-bold text-2xl text-[#020305]">
                    {ticket.subject}
                  </h1>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(ticket.status)}`}
                >
                  {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                </span>
              </div>

              <div className="w-full flex flex-col gap-4 bg-white border border-[#C6C6CB] rounded-xl p-6">
                {messagesQuery.isLoading ? (
                  <p className="text-sm text-[#767676]">Loading conversation…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-[#767676]">No messages yet.</p>
                ) : (
                  messages.map((message) => {
                    const fromSupport = message.senderRole === "SUPER_ADMIN";
                    return (
                      <div
                        key={message.id}
                        className={`flex flex-col gap-1 max-w-[80%] ${fromSupport ? "self-start" : "self-end items-end"}`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#767676]">
                          {fromSupport ? "Support" : "You"}
                        </span>
                        <div
                          className={`px-4 py-3 rounded-2xl text-sm ${fromSupport ? "bg-neutral-100 text-[#020305]" : "bg-[#0D0D0D] text-white"}`}
                        >
                          {message.message}
                        </div>
                        <span className="text-[10px] text-[#A0A0A0]">
                          {new Date(message.createdAt).toLocaleString("en-GB")}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {errorMsg && (
                <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              {canReply ? (
                <form onSubmit={handleReply} className="w-full flex flex-col gap-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    maxLength={5000}
                    rows={3}
                    placeholder="Write a reply…"
                    className="w-full px-4 py-3 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-black resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={replyMutation.isPending || !reply.trim()}
                      className="py-3 px-6 bg-[#0D0D0D] hover:bg-black text-white rounded-full text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {replyMutation.isPending ? "Sending…" : "Send reply"}
                    </button>
                  </div>
                </form>
              ) : canReopen ? (
                <div className="w-full flex flex-col items-center gap-3 py-4">
                  <p className="text-sm text-[#767676]">
                    This ticket is {ticket.status.toLowerCase()}. Reopen it to send another message.
                  </p>
                  <button
                    type="button"
                    onClick={handleReopen}
                    disabled={reopenMutation.isPending}
                    className="py-2.5 px-6 border border-[#020305] rounded-full text-sm font-semibold text-[#020305] hover:bg-neutral-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {reopenMutation.isPending ? "Reopening…" : "Reopen ticket"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function CustomerTicketViewPage() {
  return (
    <Suspense fallback={null}>
      <TicketViewContent />
    </Suspense>
  );
}
