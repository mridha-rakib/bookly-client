"use client";

import React, { useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/spinner";

// Mirror of the customer-avatar backend contract (api/src/modules/customer-avatar/
// customer-avatar.service.ts) so an obviously-wrong file is rejected before the crop modal
// opens. The backend still re-validates (incl. magic bytes + size); this is a friendly first
// line only.
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_REJECT_MESSAGE = "Please choose a JPG, PNG or WebP image under 5 MB.";

const FALLBACK_AVATAR = "/img/authImg.png";

interface ProfileAvatarProps {
  /** Persisted avatar URL from GET /auth/me, or undefined when none has been uploaded. */
  avatarUrl?: string;
  /** A valid image was picked — the parent opens the crop modal with this file. */
  onSelectFile: (file: File) => void;
  /** True while the cropped file is being uploaded/persisted. */
  uploading?: boolean;
  /** Inline validation/upload error to show under the button. */
  error?: string;
  /** Called when the user picks an invalid file (wrong type / too big). */
  onValidationError?: (message: string) => void;
  size?: number; // size in pixels (default 120)
  editable?: boolean;
}

export default function ProfileAvatar({
  avatarUrl,
  onSelectFile,
  uploading = false,
  error,
  onValidationError,
  size = 120,
  editable = true,
}: ProfileAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-picking the same file later (onChange won't fire otherwise).
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      onValidationError?.(AVATAR_REJECT_MESSAGE);
      return;
    }

    onSelectFile(file);
  };

  return (
    <div className="flex flex-col items-center p-0 gap-4 w-full md:w-[128px] shrink-0 font-poppins">
      {/* Overlay+Border+Shadow */}
      <div
        className="relative box-border flex flex-col justify-center items-center p-0 bg-[rgba(255,255,255,0.002)] border-4 border-[#EBE7E7] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-full overflow-hidden"
        style={{ width: `${size + 8}px`, height: `${size + 8}px` }}
      >
        <img
          src={avatarUrl || FALLBACK_AVATAR}
          alt="Profile Avatar"
          className="rounded-full object-cover shrink-0"
          style={{ width: `${size}px`, height: `${size}px` }}
          onError={(e) => {
            // A transient signed-URL expiry must never leave a broken image element.
            const img = e.currentTarget;
            if (!img.dataset.fallback) {
              img.dataset.fallback = "1";
              img.src = FALLBACK_AVATAR;
            }
          }}
        />

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Spinner className="text-white size-6" />
          </div>
        )}
      </div>

      {editable && (
        <>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
          />

          {/* Change Photo Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-row items-center justify-center p-0 gap-1 w-full hover:opacity-80 active:scale-95 transition-all cursor-pointer bg-transparent border-0 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={Camera01Icon} size={14} className="text-[#111111]" />
            <span className="font-manrope font-medium text-sm leading-5 text-[#111111] whitespace-nowrap">
              {uploading ? "Uploading…" : "Change Photo"}
            </span>
          </button>

          {error && (
            <p className="font-manrope text-xs text-red-600 text-center max-w-[160px]">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
