"use client";

import React, { useState } from "react";
import AdminAccountSettings from "./AdminAccountSettings";
import PlatformConfigurationSettings from "./PlatformConfigurationSettings";
import { NoShowWindow, INITIAL_NO_SHOW_WINDOWS } from "./types";
import { useCurrentUserQuery, useChangeMyPasswordMutation, useUpdateMyProfileMutation } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";

const MIN_PASSWORD_LENGTH = 6;

const splitFullName = (value: string): { firstName: string; lastName: string } | null => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

export default function SuperAdminSettings() {
  const meQuery = useCurrentUserQuery();
  const updateProfileMutation = useUpdateMyProfileMutation();
  const changePasswordMutation = useChangeMyPasswordMutation();

  const serverFullName = meQuery.data?.profile?.fullName ?? "";
  const serverEmail = meQuery.data?.user.email ?? "";
  const serverLanguage: "EN" | "GR" = meQuery.data?.profile?.defaultLanguage ?? "EN";

  // --- Admin Account State (edit-mode only; source of truth is the /auth/me query) ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);

  const [savingLanguage, setSavingLanguage] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; message: string } | null>(null);

  // --- Platform Configuration State (OUT OF SCOPE — untouched local mock, separate phase) ---
  const [maxServices, setMaxServices] = useState(5);
  const [isEditingMaxServices, setIsEditingMaxServices] = useState(false);
  const [tempMaxServices, setTempMaxServices] = useState(maxServices);
  const [noShowWindows, setNoShowWindows] = useState<NoShowWindow[]>(INITIAL_NO_SHOW_WINDOWS);
  const [editingRowIndex, setEditingRowIndex] = useState<number>(-1);
  const [tempOpens, setTempOpens] = useState(15);
  const [tempCloses, setTempCloses] = useState(120);
  const [tempReversal, setTempReversal] = useState(90);

  // --- Admin Account Actions ---
  const startEditingName = () => {
    setTempName(serverFullName);
    setNameError(undefined);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    const parsed = splitFullName(tempName);
    if (!parsed) {
      setNameError("Enter your first and last name.");
      return;
    }
    setNameError(undefined);
    updateProfileMutation.mutate(
      { firstName: parsed.firstName, lastName: parsed.lastName },
      {
        onSuccess: () => {
          setIsEditingName(false);
          setAlertModal({ isOpen: true, message: "Name updated." });
        },
        onError: (error) => setNameError(toUserMessage(error)),
      },
    );
  };

  const handleCancelName = () => {
    setTempName(serverFullName);
    setNameError(undefined);
    setIsEditingName(false);
  };

  const handleSavePassword = () => {
    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordError(undefined);
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setIsEditingPassword(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setAlertModal({ isOpen: true, message: "Password updated successfully!" });
        },
        onError: (error) => setPasswordError(toUserMessage(error)),
      },
    );
  };

  const handleCancelPassword = () => {
    setIsEditingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(undefined);
  };

  const handleSetLanguage = (next: "EN" | "GR") => {
    if (next === serverLanguage || savingLanguage) return;
    setSavingLanguage(true);
    updateProfileMutation.mutate(
      { defaultLanguage: next },
      {
        onSuccess: () => setSavingLanguage(false),
        onError: (error) => {
          setSavingLanguage(false);
          setAlertModal({ isOpen: true, message: toUserMessage(error) });
        },
      },
    );
  };

  // --- Platform Configuration Actions (unchanged) ---
  const handleSaveMaxServices = () => {
    setMaxServices(tempMaxServices);
    setIsEditingMaxServices(false);
  };

  const handleCancelMaxServices = () => {
    setTempMaxServices(maxServices);
    setIsEditingMaxServices(false);
  };

  const startEditingRow = (index: number, row: NoShowWindow) => {
    setEditingRowIndex(index);
    setTempOpens(row.opens);
    setTempCloses(row.closes);
    setTempReversal(row.reversal);
  };

  const handleSaveRow = (index: number) => {
    setNoShowWindows((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? { ...row, opens: tempOpens, closes: tempCloses, reversal: tempReversal }
          : row
      )
    );
    setEditingRowIndex(-1);
  };

  const handleCancelRow = () => {
    setEditingRowIndex(-1);
  };

  return (
    <div
      className="h-full overflow-y-auto overflow-x-hidden no-scrollbar pr-2 pb-8 flex flex-col gap-6 font-sans"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Title section */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <h1 className="text-2xl font-semibold text-[#111827] leading-8">Settings</h1>
        <p className="text-sm text-[#4E5F78]">
          Manage and configure system platform preferences.
        </p>
      </div>

      {/* Admin Account Section */}
      {meQuery.isLoading ? (
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6">
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="mt-6 flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-6 w-full bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
      ) : meQuery.isError ? (
        <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col items-start gap-3">
          <p className="text-sm text-red-600">Could not load your account details.</p>
          <button
            onClick={() => meQuery.refetch()}
            className="text-xs font-semibold text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors cursor-pointer border-none"
          >
            Retry
          </button>
        </div>
      ) : (
        <AdminAccountSettings
          fullName={serverFullName}
          isEditingName={isEditingName}
          tempName={tempName}
          setTempName={setTempName}
          setIsEditingName={(val) => (val ? startEditingName() : setIsEditingName(false))}
          nameError={nameError}
          savingName={updateProfileMutation.isPending && isEditingName}
          email={serverEmail}
          isEditingPassword={isEditingPassword}
          setIsEditingPassword={setIsEditingPassword}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          passwordError={passwordError}
          savingPassword={changePasswordMutation.isPending}
          language={serverLanguage}
          setLanguage={handleSetLanguage}
          savingLanguage={savingLanguage}
          handleSaveName={handleSaveName}
          handleCancelName={handleCancelName}
          handleSavePassword={handleSavePassword}
          handleCancelPassword={handleCancelPassword}
        />
      )}

      {/* Platform Configuration Section */}
      <PlatformConfigurationSettings
        maxServices={maxServices}
        isEditingMaxServices={isEditingMaxServices}
        tempMaxServices={tempMaxServices}
        setTempMaxServices={setTempMaxServices}
        setIsEditingMaxServices={setIsEditingMaxServices}
        noShowWindows={noShowWindows}
        editingRowIndex={editingRowIndex}
        tempOpens={tempOpens}
        setTempOpens={setTempOpens}
        tempCloses={tempCloses}
        setTempCloses={setTempCloses}
        tempReversal={tempReversal}
        setTempReversal={setTempReversal}
        handleSaveMaxServices={handleSaveMaxServices}
        handleCancelMaxServices={handleCancelMaxServices}
        startEditingRow={startEditingRow}
        handleSaveRow={handleSaveRow}
        handleCancelRow={handleCancelRow}
      />

      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-[380px] rounded-xl overflow-hidden shadow-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-[#111827]">Notification</h3>
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-5">
              {alertModal.message}
            </p>
            <div className="flex justify-end mt-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-5 py-2 rounded-full bg-[#6366F1] hover:bg-indigo-650 text-xs font-semibold text-white border-none cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
