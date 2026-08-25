"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useCreateSupportTicketMutation, useSupportTicketsQuery } from "@/lib/support/hooks";
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

/** Batch 15B — the smallest design-consistent Customer "My Tickets" list, following the same
 * layout conventions customer/bookings/page.tsx already established. */
export default function CustomerTicketsPage() {
  return (
    <RequireCustomer>
      <CustomerTicketsPageContent />
    </RequireCustomer>
  );
}

function CustomerTicketsPageContent() {
  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const ticketsQuery = useSupportTicketsQuery({ limit: 50 });
  const tickets = ticketsQuery.data?.tickets ?? [];
  const createMutation = useCreateSupportTicketMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setErrorMsg("Please fill in both fields.");
      return;
    }
    setErrorMsg("");
    try {
      await createMutation.mutateAsync({ subject, message });
      setSubject("");
      setMessage("");
      setShowCreateForm(false);
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center py-12">
        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          <div className="w-full flex items-center justify-between gap-4">
            <h1 className="font-manrope font-bold text-[30px] leading-[36px] tracking-[-0.75px] text-[#020305]">
              My Tickets
            </h1>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="py-3 px-6 bg-[#0D0D0D] hover:bg-black text-white rounded-full text-sm font-semibold transition-colors cursor-pointer"
            >
              {showCreateForm ? "Close" : "New ticket"}
            </button>
          </div>

          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="w-full bg-white border border-[#C6C6CB] rounded-xl p-6 flex flex-col gap-4"
            >
              {errorMsg && (
                <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider uppercase text-[#45474B]">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="What is this regarding?"
                  className="w-full h-12 px-4 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold tracking-wider uppercase text-[#45474B]">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  placeholder="Describe your issue"
                  className="w-full px-4 py-3 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-black resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="py-3 px-6 bg-[#0D0D0D] hover:bg-black text-white rounded-full text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? "Submitting…" : "Submit ticket"}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col items-start gap-4 w-full">
            {ticketsQuery.isLoading ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl">
                <p className="text-[#45474B] text-lg font-medium">Loading your tickets…</p>
              </div>
            ) : ticketsQuery.isError ? (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl">
                <p className="text-[#45474B] text-lg font-medium">
                  Your tickets could not be loaded right now.
                </p>
              </div>
            ) : tickets.length > 0 ? (
              tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/customer/tickets/view?id=${ticket.id}`}
                  className="w-full flex items-center justify-between bg-white border border-[#C6C6CB] rounded-xl p-5 hover:border-black transition-colors"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-mono text-[#767676]">{ticket.reference}</span>
                    <span className="font-manrope font-semibold text-base text-[#020305]">
                      {ticket.subject}
                    </span>
                    <span className="text-xs text-[#767676]">
                      {new Date(ticket.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(ticket.status)}`}
                  >
                    {ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                  </span>
                </Link>
              ))
            ) : (
              <div className="w-full text-center py-20 bg-white border border-[#C6C6CB] rounded-xl">
                <p className="text-[#45474B] text-lg font-medium">
                  You have no support tickets yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
