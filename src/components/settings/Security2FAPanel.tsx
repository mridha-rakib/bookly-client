import React, { useState } from "react";

import { useCurrentUserQuery } from "@/lib/auth/hooks";
import TwoFactorSettings from "./TwoFactorSettings";
import UpdatePasswordModal from "./UpdatePasswordModal";

/** Account-owned professional password and authenticator settings. */
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
            Protect your account by requiring an authenticator or recovery code on every new sign-in
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

        <div className="p-6"><TwoFactorSettings /></div>

      </div>

      <UpdatePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
