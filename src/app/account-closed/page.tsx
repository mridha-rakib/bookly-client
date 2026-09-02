"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth/store";
import { queryClient } from "@/lib/query-client";

/**
 * Post-closure confirmation. Reached via `router.replace("/account-closed")` from the Settings
 * delete flow while the session is still "authenticated" (so RequireCustomer on the Settings
 * page never redirects first). This page is unguarded and performs the client-side auth teardown
 * itself — the DELETE /auth/me response has already revoked every session and cleared the
 * refresh cookie server-side.
 */
export default function AccountClosedPage() {
  useEffect(() => {
    useAuthStore.getState().clearAuth();
    queryClient.clear();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center px-4 font-poppins">
      <div className="w-full max-w-[440px] bg-white border border-[#E6E9EF] rounded-2xl p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="text-lg font-bold text-[#020305] mb-2">Your account has been closed</h1>
        <p className="text-sm text-[#4E5F78] leading-relaxed">
          Your Bookly account has been closed and you have been signed out. Your personal details
          have been removed. Records we are required to keep, such as past bookings and their
          payment history, are retained in anonymized form.
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white text-sm font-semibold transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
