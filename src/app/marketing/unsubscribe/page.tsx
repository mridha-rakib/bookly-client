"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { marketingApi } from "@/lib/api/marketing";

type Status = "working" | "done" | "error";

/**
 * Public marketing unsubscribe landing (Stage M2). Reached from the "Unsubscribe" link in a
 * marketing email. It reads the signed `?token=`, POSTs it once to the public endpoint, and
 * shows a neutral result. No login, no account details, no re-subscribe control (opt-in only
 * ever happens in authenticated Settings, in a later phase).
 */
function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // Initial state is derived from token presence, so the effect never needs a synchronous
  // setState — a missing token is already "error" on first render.
  const [status, setStatus] = useState<Status>(token ? "working" : "error");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !token) {
      return;
    }
    startedRef.current = true;

    marketingApi
      .unsubscribe(token)
      .then(() => setStatus("done"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center px-4 font-poppins">
      <div className="w-full max-w-[440px] bg-white border border-[#E6E9EF] rounded-2xl p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        {status === "working" && (
          <>
            <div className="w-10 h-10 border-4 border-[#2E9DA7] border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <p className="text-sm text-[#4E5F78]">Updating your email preferences…</p>
          </>
        )}

        {status === "done" && (
          <>
            <h1 className="text-lg font-bold text-[#020305] mb-2">You&apos;re unsubscribed</h1>
            <p className="text-sm text-[#4E5F78] leading-relaxed">
              You have been unsubscribed from marketing emails. You will still receive booking
              confirmations, reminders you&apos;ve enabled, and important account messages.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-lg font-bold text-[#020305] mb-2">Link not available</h1>
            <p className="text-sm text-[#4E5F78] leading-relaxed">
              This unsubscribe link is invalid or no longer available.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketingUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center font-poppins">
          <div className="w-10 h-10 border-4 border-[#2E9DA7] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
