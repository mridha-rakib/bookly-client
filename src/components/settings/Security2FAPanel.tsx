import Image from "next/image";
import React, { useState } from "react";

import { useCurrentUserQuery } from "@/lib/auth/hooks";
import UpdatePasswordModal from "./UpdatePasswordModal";

/** Batch 19 — made honest, then Phase 1 made Password real. No Business-role (Owner/Supervisor/
 * Staff) 2FA backend exists anywhere in this codebase yet — the Email Authentication toggle
 * below stays disabled with an honest note rather than fabricating a "verified" state. Password
 * management now reuses the same real PATCH /auth/me/password path CUSTOMER/SUPER_ADMIN already
 * had (see auth.route.ts), gated per-account on `hasPassword` from GET /auth/me: an OAuth-only
 * account (no local password) gets a truthful non-interactive message instead of a fake
 * "Create Password" flow, since no such endpoint exists yet. */
export const Security2FAPanel: React.FC = () => {
  const meQuery = useCurrentUserQuery();
  const hasPassword = meQuery.data?.user.hasPassword ?? false;
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-[20px] w-full font-poppins">
      <div className="flex flex-col gap-1">
        <h2 className="font-poppins font-medium text-base text-[#111111]">Security & 2FA</h2>
        <p className="font-poppins font-normal text-xs text-[#666666]">Change your password, set 2FA of your account</p>
      </div>

      {/* Main card */}
      <div className="bg-white border border-[#DEDDE3] rounded-[16px] overflow-hidden shadow-none flex flex-col w-full">

        {/* Secure your account header */}
        <div className="p-6 border-b border-[#F1F5F9] bg-white flex flex-col gap-1">
          <h3 className="font-poppins font-medium text-sm text-[#111111]">Secure your account</h3>
          <p className="font-poppins font-normal text-xs text-neutral-400 leading-normal">
            Protect your account by requiring an extra verification step when signing in from an unrecognized device
          </p>
        </div>

        {/* Password details Row */}
        <div className="p-6 bg-white flex items-center justify-between border-b border-[#F1F5F9]">
          <div className="flex flex-col">
            <span className="font-medium text-sm text-[#111111]">Password</span>
            <span className="text-xs text-neutral-400 mt-0.5">
              {meQuery.isLoading
                ? "Loading…"
                : hasPassword
                  ? "Update your account password."
                  : "Password sign-in is not configured for this account."}
            </span>
          </div>
          <button
            type="button"
            disabled={meQuery.isLoading || !hasPassword}
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-3.5 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-[#111111] cursor-pointer disabled:text-neutral-400 disabled:cursor-not-allowed"
          >
            Update Password
          </button>
        </div>

        {/* Set 2FA Verification Area */}
        <div className="p-6 bg-white flex flex-col gap-4">
          <div className="flex flex-col">
            <span className="font-medium text-sm text-[#111111]">Set 2FA Verification</span>
            <span className="text-xs text-neutral-400 mt-0.5">Not available yet.</span>
          </div>

          {/* Auth Card Box */}
          <div className="border border-[#E2E8F0] rounded-[16px] p-6 bg-white shadow-[0px_2px_10px_-4px_rgba(0,0,0,0.05)] w-full">
            <div className="flex items-start justify-between gap-4">

              <div className="flex gap-4">
                {/* Custom Gradient Icon Container */}
                <div className="w-12 h-12 rounded-[16px] bg-gradient-to-b from-[#0CC0DF]/20 to-[#0CC0DF]/20 bg-[#8EBAC5] flex items-center justify-center shrink-0">
                  <Image src="/Icons/Email.svg" alt="Email" className="w-6 h-6 object-contain" width={24} height={24} />
                </div>

                <div className="flex flex-col">
                  <span className="font-medium text-[15px] leading-snug text-[#182133]">Email Authentication</span>
                  <span className="text-xs text-[#62748E] leading-relaxed mt-1 max-w-[380px]">
                    Receive a secure 6-digit verification code at your registered email address.
                  </span>
                </div>
              </div>

              {/* 2FA Toggle switch — disabled, no backend capability exists */}
              <div
                title="Not available yet"
                className="w-[44px] h-[24px] rounded-full bg-[#E2E8F0] opacity-60 cursor-not-allowed flex items-center p-0.5 shrink-0"
              >
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>

            </div>
          </div>

        </div>

      </div>

      <UpdatePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
