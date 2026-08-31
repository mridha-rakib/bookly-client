"use client";

import React, { useState } from "react";

import type { StaffCreatableRole } from "@/lib/api/staff";

export type StaffAccessChangeMode = "role" | "deactivate" | "reactivate";

interface StaffAccessChangeModalProps {
  mode: StaffAccessChangeMode | null;
  staffName: string;
  businessName: string;
  /** Current persisted role — only meaningful for `mode === "role"`. */
  currentRole: StaffCreatableRole;
  /** Current persisted status label. */
  currentStatus: "Active" | "Inactive";
  /** Mutation in flight — disables both actions and prevents a double submit. */
  pending: boolean;
  /** Inline error from the last failed attempt (kept on screen, modal stays open). */
  errorMessage?: string;
  onClose: () => void;
  /**
   * Fired ONLY from the final confirmation step. For `role` mode the chosen new role is passed;
   * for `deactivate` / `reactivate` there is no argument. The parent owns the mutation and
   * closes the modal on success.
   */
  onConfirm: (newRole?: StaffCreatableRole) => void;
}

const roleLabel = (role: StaffCreatableRole): string =>
  role === "SUPERVISOR" ? "Supervisor" : "Staff";

const otherRole = (role: StaffCreatableRole): StaffCreatableRole =>
  role === "SUPERVISOR" ? "STAFF" : "SUPERVISOR";

export default function StaffAccessChangeModal({
  mode,
  staffName,
  businessName,
  currentRole,
  currentStatus,
  pending,
  errorMessage,
  onClose,
  onConfirm,
}: StaffAccessChangeModalProps) {
  // The parent remounts this component (via `key`) for each target, so the wizard always
  // starts fresh at step 1 with the sensible default new role — no reset effect needed.
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<StaffCreatableRole>(otherRole(currentRole));

  if (!mode) return null;

  const title =
    mode === "role"
      ? step === 1
        ? "Change role"
        : "Confirm role change?"
      : mode === "deactivate"
        ? step === 1
          ? "Deactivate staff access"
          : `Deactivate ${staffName}?`
        : step === 1
          ? "Reactivate staff access"
          : `Reactivate ${staffName}?`;

  const primaryLabel =
    step === 1
      ? "Continue"
      : mode === "role"
        ? "Confirm Change"
        : mode === "deactivate"
          ? "Deactivate Staff"
          : "Reactivate Staff";

  const roleUnchanged = mode === "role" && selectedRole === currentRole;

  const handlePrimary = () => {
    if (pending) return;
    if (step === 1) {
      if (roleUnchanged) return;
      setStep(2);
      return;
    }
    onConfirm(mode === "role" ? selectedRole : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins"
      onClick={pending ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] max-w-full bg-white rounded-xl shadow-2xl flex flex-col p-5 gap-4 relative animate-fadeIn"
      >
        <div className="flex flex-col gap-1">
          <h3 className="font-poppins font-medium text-[18px] leading-[26px] text-[#09090B]">
            {title}
          </h3>
          <p className="font-poppins font-normal text-[13px] leading-[20px] text-[#525252]">
            {mode === "role"
              ? step === 1
                ? `Update ${staffName}'s role at ${businessName}. Their available access will follow their role.`
                : `You are changing ${staffName}'s role at ${businessName}. Their available access may change.`
              : mode === "deactivate"
                ? step === 1
                  ? `${staffName} currently has ${currentStatus.toLowerCase()} access to ${businessName}. Deactivating it disables their access until it is reactivated — it is not a removal.`
                  : `${staffName} will no longer have active access to ${businessName} until reactivated.`
                : step === 1
                  ? `${staffName} currently has ${currentStatus.toLowerCase()} access to ${businessName}. Reactivating restores their access using their existing staff account.`
                  : `This will restore ${staffName}'s active access to ${businessName}.`}
          </p>
        </div>

        {mode === "role" && (
          <div className="flex flex-col gap-3 rounded-lg bg-[#FAFAFA] border border-[#EDEDED] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[#737373]">Current role</span>
              <span className="text-[12px] font-medium text-[#111111]">
                {roleLabel(currentRole)}
              </span>
            </div>
            {step === 1 ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#737373]">New role</span>
                <select
                  value={selectedRole}
                  disabled={pending}
                  onChange={(e) => setSelectedRole(e.target.value as StaffCreatableRole)}
                  className="h-9 rounded-lg border border-[#DADADA] bg-white px-2 text-[13px] text-[#111111] focus:outline-none focus:border-[#111111] disabled:opacity-60"
                >
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="STAFF">Staff</option>
                </select>
              </label>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#737373]">Changing to</span>
                <span className="text-[12px] font-semibold text-[#111111]">
                  {roleLabel(selectedRole)}
                </span>
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg bg-[#FFF5F5] border border-[#FCDDEC] px-3 py-2 text-[12px] font-medium text-[#DE350B]">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-[34px] px-4 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={pending || (step === 1 && roleUnchanged)}
            className="h-[34px] px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Saving..." : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
