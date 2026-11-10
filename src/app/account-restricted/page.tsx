"use client";

import Link from "next/link";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth/store";
import { queryClient } from "@/lib/query-client";

/**
 * P2.2.6 — shown when Bookly has suspended the signed-in account (the API answered 403
 * USER_SUSPENDED). Unguarded, like /account-closed: it performs the client-side teardown itself
 * so no previous account data stays cached in this tab.
 */
export default function AccountRestrictedPage() {
  useEffect(() => {
    useAuthStore.getState().clearAuth();
    queryClient.clear();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex items-center justify-center px-4 font-poppins">
      <div className="w-full max-w-[440px] bg-white border border-[#E6E9EF] rounded-2xl p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <h1 className="text-lg font-bold text-[#020305] mb-2">Your account is restricted</h1>
        <p className="text-sm text-[#4E5F78] leading-relaxed">
          Bookly has suspended access to this account, so you have been signed out and can&apos;t
          sign in, book or make changes for now. Your existing bookings and payment records are
          kept as they are. If you think this is a mistake, please contact support.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact-support"
            className="inline-block px-5 py-2.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-white text-sm font-semibold transition-colors"
          >
            Contact support
          </Link>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-lg border border-[#1A1A1A]/20 text-[#1A1A1A] text-sm font-semibold"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
