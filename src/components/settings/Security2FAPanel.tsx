import Image from "next/image";
import React from "react";

/** Batch 19 — made honest. No Business-role (Owner/Supervisor/Staff) password-change or 2FA
 * backend exists anywhere in this codebase (only CUSTOMER has PATCH /auth/me/password — see
 * Batch 17/18) — this used to fake a working password button and a working email-OTP 2FA flow
 * with no real verification behind either. Design/layout preserved; both controls are now
 * disabled with an honest note instead of silently doing nothing (password) or fabricating a
 * "verified" state (2FA). */
export const Security2FAPanel: React.FC = () => {
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
            <span className="text-xs text-neutral-400 mt-0.5">Password management isn&apos;t available yet.</span>
          </div>
          <button
            disabled={true}
            className="px-3.5 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-neutral-400 cursor-not-allowed"
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
    </div>
  );
};
