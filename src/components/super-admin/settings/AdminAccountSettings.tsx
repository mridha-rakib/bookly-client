"use client";

import React from "react";

interface AdminAccountSettingsProps {
  fullName: string;
  isEditingName: boolean;
  tempName: string;
  setTempName: (val: string) => void;
  setIsEditingName: (val: boolean) => void;
  nameError?: string;
  savingName?: boolean;
  email: string;
  isEditingPassword: boolean;
  setIsEditingPassword: (val: boolean) => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  passwordError?: string;
  savingPassword?: boolean;
  language: "EN" | "GR";
  setLanguage: (val: "EN" | "GR") => void;
  savingLanguage?: boolean;
  handleSaveName: () => void;
  handleCancelName: () => void;
  handleSavePassword: () => void;
  handleCancelPassword: () => void;
}

export default function AdminAccountSettings({
  fullName,
  isEditingName,
  tempName,
  setTempName,
  setIsEditingName,
  nameError,
  savingName,
  email,
  isEditingPassword,
  setIsEditingPassword,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordError,
  savingPassword,
  language,
  setLanguage,
  savingLanguage,
  handleSaveName,
  handleCancelName,
  handleSavePassword,
  handleCancelPassword,
}: AdminAccountSettingsProps) {
  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4">
      <div className="border-b border-[#E5E7EB] pb-3">
        <h2 className="text-lg font-semibold text-[#111827] leading-[22px]">Admin Account</h2>
      </div>

      <div className="flex flex-col">
        {/* Full Name Row */}
        <div className="flex flex-col sm:flex-row sm:items-start py-4 border-b border-[#E5E7EB] gap-2 min-h-[64px]">
          <div className="w-full sm:w-1/3 text-sm font-medium text-[#6B7280] pt-1.5">Full name</div>
          <div className="w-full sm:w-1/3 text-sm text-[#111827]">
            {isEditingName ? (
              <div className="flex flex-col gap-1 w-full max-w-xs">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
                {nameError && <span className="text-xs text-red-600">{nameError}</span>}
              </div>
            ) : (
              <span className="pt-1.5 inline-block">{fullName}</span>
            )}
          </div>
          <div className="w-full sm:w-1/3 flex sm:justify-start">
            {isEditingName ? (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="text-xs font-semibold text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingName ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancelName}
                  disabled={savingName}
                  className="text-xs font-semibold text-[#111111] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer border-none disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs font-medium text-[#6366F1] hover:underline cursor-pointer border-none bg-transparent pt-1.5"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Email Row — read-only. A verified admin email-change flow is a separate phase. */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 border-b border-[#E5E7EB] gap-2 min-h-[64px]">
          <div className="w-full sm:w-1/3 text-sm font-medium text-[#6B7280]">Email</div>
          <div className="w-full sm:w-1/3 text-sm text-[#111827] truncate">{email}</div>
          <div className="w-full sm:w-1/3 flex sm:justify-start">
            <span className="text-xs text-[#9CA3AF]">Managed by Bookly</span>
          </div>
        </div>

        {/* Password Row */}
        <div className="flex flex-col sm:flex-row sm:items-start py-4 border-b border-[#E5E7EB] gap-2 min-h-[64px]">
          <div className="w-full sm:w-1/3 text-sm font-medium text-[#6B7280] pt-1">Password</div>
          <div className="w-full sm:w-1/3 text-sm text-[#111827] flex flex-col gap-2">
            {isEditingPassword ? (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
                {passwordError && <span className="text-xs text-red-600">{passwordError}</span>}
              </div>
            ) : (
              "•••••••••••"
            )}
          </div>
          <div className="w-full sm:w-1/3 flex sm:justify-start">
            {isEditingPassword ? (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="text-xs font-semibold text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleCancelPassword}
                  disabled={savingPassword}
                  className="text-xs font-semibold text-[#111111] bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer border-none disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingPassword(true)}
                className="text-xs font-medium text-[#6366F1] hover:underline cursor-pointer border-none bg-transparent"
              >
                Change Password
              </button>
            )}
          </div>
        </div>

        {/* Language Row */}
        <div className="flex flex-col sm:flex-row sm:items-center py-4 gap-2 min-h-[58px]">
          <div className="w-full sm:w-1/3 text-sm font-medium text-[#6B7280]">Default language</div>
          <div className="w-full sm:w-1/3 text-sm text-[#111827]">
            {language === "EN" ? "English (EN)" : "Greek (GR)"}
          </div>
          <div className="w-full sm:w-1/3 flex sm:justify-start">
            <div className="w-full sm:w-1/3 flex sm:justify-start">
              <div className="inline-flex bg-[#F9FAFB] border border-[#E5E7EB] rounded-full p-0.5">
                <button
                  onClick={() => setLanguage("EN")}
                  disabled={savingLanguage}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border-none cursor-pointer transition-all disabled:cursor-not-allowed ${
                    language === "EN"
                      ? "bg-[#6366F1] text-white"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage("GR")}
                  disabled={savingLanguage}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border-none cursor-pointer transition-all disabled:cursor-not-allowed ${
                    language === "GR"
                      ? "bg-[#6366F1] text-white"
                      : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  GR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
