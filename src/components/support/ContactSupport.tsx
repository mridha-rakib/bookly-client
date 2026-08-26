"use client";

import React, { useState } from "react";

// Modular sub-components inside same folder
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { useCreateSupportTicketMutation, useSupportTicketQuery } from "@/lib/support/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { buildDashboardSubtitle } from "@/utils/dashboardGreeting";
import SupportBreadcrumbs from "./SupportBreadcrumbs";
import SupportFormFields from "./SupportFormFields";
import SupportFormActions from "./SupportFormActions";
import RequesterTicketList from "./RequesterTicketList";
import RequesterTicketDetail from "./RequesterTicketDetail";

interface ContactSupportProps {
  setActiveTab: (tab: string) => void;
}

type Mode = "list" | "create" | "detail";

/**
 * Batch 15B built real Support Ticket creation for Business Owner/Supervisor/Staff (they share
 * this exact component). Batch 15C closes the read-back gap the Batch 15B report flagged: these
 * three roles could create a Ticket but had no way to see it again. Rather than a new page/nav
 * item, this tab now hosts three modes (list / create / detail) using the SAME "swap the main
 * pane by local state + breadcrumb back-link" convention already established in this exact
 * dashboard shell by the Bookings and Clients tabs (see business-dashboard/page.tsx and
 * ClientsPage.tsx) — no modal/drawer, no new design language.
 */
export default function ContactSupport({ setActiveTab }: ContactSupportProps) {
  const currentUserQuery = useCurrentUserQuery();
  const [mode, setMode] = useState<Mode>("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  // Shares its cache entry with RequesterTicketDetail's own identical query (same ticketId) —
  // only fetched once, used here solely to show the real reference in the breadcrumb.
  const selectedTicketQuery = useSupportTicketQuery(
    mode === "detail" ? (selectedTicketId ?? undefined) : undefined,
  );

  const breadcrumbTrail =
    mode === "create"
      ? [{ label: "Contact Support", onClick: () => setMode("list") }, { label: "New request" }]
      : mode === "detail"
        ? [
            { label: "Contact Support", onClick: () => setMode("list") },
            { label: selectedTicketQuery.data?.reference ?? "Ticket" },
          ]
        : undefined;

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      <DashboardHeader title="Support" subtitle={buildDashboardSubtitle(currentUserQuery.data?.profile?.firstName)} />

      <div className="flex-1 overflow-y-auto pl-12 pr-6 md:pr-8 py-6 flex flex-col gap-[30px] w-full max-w-[864px]">
        <SupportBreadcrumbs setActiveTab={setActiveTab} trail={breadcrumbTrail} />

        {mode === "list" && (
          <>
            <div className="flex items-center justify-between w-full md:w-[calc(100%-118px)] ml-0 md:ml-[118px]">
              <h2 className="font-manrope font-semibold text-2xl leading-[26px] text-[#16123E]">
                My Tickets
              </h2>
              <button
                type="button"
                onClick={() => setMode("create")}
                className="flex justify-center items-center px-4 py-2.5 gap-2 bg-[#0D0D0D] hover:bg-neutral-800 rounded-xl font-manrope font-medium text-sm text-white transition-all cursor-pointer"
              >
                New request
              </button>
            </div>
            <RequesterTicketList
              onSelectTicket={(ticketId) => {
                setSelectedTicketId(ticketId);
                setMode("detail");
              }}
            />
          </>
        )}

        {mode === "detail" && selectedTicketId && (
          <RequesterTicketDetail ticketId={selectedTicketId} />
        )}

        {mode === "create" && <CreateTicketForm onSubmitted={() => setMode("list")} />}
      </div>
    </main>
  );
}

/** The original Batch 15B create-ticket form, unchanged in behavior — only extracted into its own
 * mode so it can sit alongside the new list/detail views on the same tab. */
function CreateTicketForm({ onSubmitted }: { onSubmitted: () => void }) {
  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data;
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const createMutation = useCreateSupportTicketMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setErrorMsg("Please fill in all the required fields.");
      return;
    }
    setErrorMsg("");
    try {
      await createMutation.mutateAsync({ subject, message: description });
      setSubject("");
      setDescription("");
      onSubmitted();
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    }
  };

  const handleCancel = () => {
    setSubject("");
    setDescription("");
    setErrorMsg("");
    onSubmitted();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col w-full md:w-[calc(100%-118px)] bg-white border border-[#F1F5F9] rounded-2xl shadow-sm overflow-hidden ml-0 md:ml-[118px]"
    >
      <div className="flex flex-row items-center p-6 gap-1 bg-[#F8FAFC] border-b border-[#F1F5F9] shrink-0">
        <div className="flex flex-row items-center gap-1 w-full h-[26px]">
          <h2 className="font-manrope font-semibold text-2xl leading-[26px] text-[#16123E]">
            Contact Support
          </h2>
        </div>
      </div>

      <div className="flex flex-col items-start p-6 md:p-8 gap-5 bg-white">
        {errorMsg && (
          <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-poppins">
            {errorMsg}
          </div>
        )}

        <SupportFormFields
          name={currentUser?.profile ? `${currentUser.profile.firstName} ${currentUser.profile.lastName}` : ""}
          email={currentUser?.user.email ?? ""}
          subject={subject}
          setSubject={setSubject}
          description={description}
          setDescription={setDescription}
        />
      </div>

      <SupportFormActions onCancel={handleCancel} isSubmitting={createMutation.isPending} />
    </form>
  );
}
