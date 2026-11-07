"use client";

import React from "react";

import type { SupportConversation } from "@/lib/support/conversation";

interface SupportOlderMessagesProps {
  conversation: SupportConversation;
  textClassName?: string;
  buttonClassName?: string;
}

/** P1.8 — "Load older messages" control shared by Customer, Business requester and Super Admin
 * conversations. A failed older page keeps every loaded message and offers Retry. */
export default function SupportOlderMessages({
  conversation,
  textClassName = "text-xs text-[#767676]",
  buttonClassName = "px-4 py-1.5 border border-[#C6C6CB] rounded-full text-xs font-semibold text-[#020305] hover:border-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
}: SupportOlderMessagesProps) {
  const { hasOlder, isLoadingOlder, olderError, loadOlder, messages, total } = conversation;
  if (!hasOlder) return null;

  return (
    <div className="w-full flex flex-col items-center gap-2" data-testid="support-older-messages">
      <span className={textClassName}>
        Showing the latest {messages.length} of {total} messages
      </span>
      {olderError ? (
        <span role="alert" className={`${textClassName} text-red-600`}>
          Older messages could not be loaded.
        </span>
      ) : null}
      <button type="button" onClick={loadOlder} disabled={isLoadingOlder} className={buttonClassName}>
        {isLoadingOlder ? "Loading older messages…" : olderError ? "Retry" : "Load older messages"}
      </button>
    </div>
  );
}
