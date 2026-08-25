"use client";

import React from "react";

interface SupportFormActionsProps {
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function SupportFormActions({ onCancel, isSubmitting }: SupportFormActionsProps) {
  return (
    <div className="flex flex-row justify-end items-center p-5 gap-4 border-t border-[#F1F5F9] bg-[#F8FAFC] shrink-0">
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="flex justify-center items-center px-4 py-3 gap-2 w-[85px] h-12 border border-[#5A576B] rounded-xl font-manrope font-medium text-base text-[#5A576B] hover:bg-neutral-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex justify-center items-center px-4 py-3 gap-2 min-w-[86px] h-12 bg-[#0D0D0D] hover:bg-neutral-800 rounded-xl font-manrope font-medium text-base text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Sending…" : "Submit"}
      </button>
    </div>
  );
}
