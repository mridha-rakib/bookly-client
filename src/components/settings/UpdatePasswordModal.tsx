"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useChangeMyPasswordMutation } from "@/lib/auth/hooks";

const MIN_PASSWORD_LENGTH = 6;

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatePasswordModal({ isOpen, onClose }: UpdatePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const changePasswordMutation = useChangeMyPasswordMutation();

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(undefined);
  };

  const handleClose = () => {
    if (changePasswordMutation.isPending) return;
    resetFields();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (changePasswordMutation.isPending) return;

    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setError(undefined);
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          resetFields();
          toast.success("Password updated successfully.");
          onClose();
        },
        onError: (mutationError) => {
          setError(toUserMessage(mutationError));
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative flex flex-col items-center w-[438px] max-w-full bg-white rounded-xl shadow-[0px_2px_3px_rgba(0,0,0,0.25)] p-5 gap-5 animate-fadeIn"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center text-[#4D4D4D] hover:text-[#262626] cursor-pointer disabled:opacity-60"
          disabled={changePasswordMutation.isPending}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
        </button>

        <form onSubmit={handleSubmit} className="flex flex-col items-center w-full gap-5">
          <div className="flex flex-col items-center gap-1 w-full">
            <h2 className="w-full font-poppins font-medium text-[22px] leading-8 text-center text-[#262626]">
              Update Password
            </h2>
            <p className="w-full font-poppins font-normal text-sm leading-5 text-center text-[#4D4D4D]">
              Enter your current password and choose a new one.
            </p>
          </div>

          <div className="flex flex-col items-start gap-1 w-full">
            <label
              htmlFor="update-password-current"
              className="font-poppins font-medium text-sm leading-5 tracking-[-0.015em] text-[#262626]"
            >
              Current password
            </label>
            <input
              id="update-password-current"
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              autoFocus
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full px-4 py-3.5 bg-[#F4F4F6] border border-[#DAD6FF] rounded-xl font-poppins text-sm text-[#262626] placeholder-[#808080] focus:outline-none"
            />
          </div>

          <div className="flex flex-col items-start gap-1 w-full">
            <label
              htmlFor="update-password-new"
              className="font-poppins font-medium text-sm leading-5 tracking-[-0.015em] text-[#262626]"
            >
              New password
            </label>
            <input
              id="update-password-new"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full px-4 py-3.5 bg-[#F4F4F6] border border-[#DAD6FF] rounded-xl font-poppins text-sm text-[#262626] placeholder-[#808080] focus:outline-none"
            />
          </div>

          <div className="flex flex-col items-start gap-1 w-full">
            <label
              htmlFor="update-password-confirm"
              className="font-poppins font-medium text-sm leading-5 tracking-[-0.015em] text-[#262626]"
            >
              Confirm new password
            </label>
            <input
              id="update-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full px-4 py-3.5 bg-[#F4F4F6] border border-[#DAD6FF] rounded-xl font-poppins text-sm text-[#262626] placeholder-[#808080] focus:outline-none"
            />
          </div>

          {error && <p className="w-full text-xs text-red-600 -mt-2">{error}</p>}

          <div className="flex flex-col items-center gap-2 w-full">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="flex flex-row justify-center items-center px-8 py-5 gap-2 w-full h-[52px] bg-[#0D0D0D] hover:bg-black text-white rounded-xl font-poppins font-medium text-sm tracking-[-0.015em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {changePasswordMutation.isPending ? <Spinner className="text-white" /> : "Update Password"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={changePasswordMutation.isPending}
              className="font-poppins font-medium text-base leading-6 tracking-[-0.015em] text-[#240183] hover:underline cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
