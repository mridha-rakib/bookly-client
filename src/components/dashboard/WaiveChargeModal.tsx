"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

interface WaiveChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `reason` is required by the backend (bookingsApi.waiveFee) — one of the dropdown options
   * below. `internalNote` is optional and is NEVER exposed to any customer-facing read. */
  onConfirm: (reason: string, internalNote?: string) => void;
}

export default function WaiveChargeModal({ isOpen, onClose, onConfirm }: WaiveChargeModalProps) {
  const [reason, setReason] = useState("Customer did not attend");
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!isOpen) return null;

  const reasons = [
    "Customer did not attend",
    "Emergency cancellation",
    "Rescheduled via phone",
    "Customer is regular / VIP",
    "Other reason"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[361px] bg-white rounded-xl shadow-2xl flex flex-col items-center p-4 gap-3 relative animate-fadeIn"
      >
        {/* Frame 2147228120 - Header Info */}
        <div className="flex flex-col items-center p-0 gap-2 w-[329px]">
          
          {/* btn / danger exclamation */}
          <div className="w-14 h-14 bg-[#D44343] rounded-full flex items-center justify-center text-white text-[28px] font-medium font-poppins select-none shrink-0">
            !
          </div>

          {/* Title */}
          <h3 className="w-[329px] font-poppins font-medium text-[28px] leading-[36px] text-[#09090B] text-center">
            Are you sure you want to waive fee?
          </h3>

          {/* Subtext */}
          <p className="w-[329px] font-poppins font-normal text-[14px] leading-[20px] tracking-[0.0025em] text-[#525252] text-center">
            This action is irreversible. Once you waive the fee, it cannot be reinstated. No charge will be made to the customer&apos;s card.
          </p>
        </div>

        {/* Frame 2147240028 - Input fields */}
        <div className="flex flex-col items-center p-0 gap-4 w-[329px] relative">
          
          {/* Reason Field */}
          <div className="flex flex-col items-start p-0 gap-2 w-[329px] relative">
            <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
              Reason for waving (required)
            </label>
            
            <div 
              onClick={() => setShowReasonDropdown(!showReasonDropdown)}
              className="box-border flex flex-row justify-between items-center p-3 gap-2.5 w-[329px] h-[46px] border border-[#111111]/60 rounded-xl bg-white cursor-pointer select-none"
            >
              <span className="font-poppins font-normal text-sm text-[#111111] truncate">
                {reason}
              </span>
              <HugeiconsIcon icon={ArrowDown01Icon} className={`w-5 h-5 text-[#111111]/60 transition-transform duration-200 ${showReasonDropdown ? "rotate-180" : ""}`} />
            </div>

            {/* Custom dropdown overlay */}
            {showReasonDropdown && (
              <div className="absolute top-[78px] left-0 right-0 z-10 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 flex flex-col max-h-[180px] overflow-y-auto">
                {reasons.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setReason(item);
                      setShowReasonDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-50 font-poppins text-sm text-[#111111] transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Internal note field */}
          <div className="flex flex-col items-start p-0 gap-2 w-[329px]">
            <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
              Internal note (optional)
            </label>
            <textarea
              placeholder="Add a private note about this no-show..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="box-border w-[329px] h-[120px] border border-[#111111]/60 rounded-xl p-3 gap-2.5 font-poppins font-normal text-sm text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:border-red-500 resize-none"
            />
          </div>

        </div>

        {/* Frame 2147228043 - Buttons footer */}
        <div className="flex flex-row justify-end items-center p-0 gap-3 w-[329px] mt-1">
          <button
            type="button"
            onClick={onClose}
            className="box-border flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[101px] h-11 bg-[#F1F1F2] border border-[#D3D3D6] shadow-[0px_0px_2px_rgba(62,62,68,0.2)] rounded-xl font-poppins font-medium text-sm text-[#3E3E44] tracking-[0.03em] hover:bg-[#E4E4E6] cursor-pointer transition-all duration-200"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => onConfirm(reason, internalNote.trim() || undefined)}
            className="flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[74px] h-11 bg-[#D44343] hover:bg-red-700 rounded-xl font-poppins font-medium text-sm text-white tracking-[0.03em] cursor-pointer transition-all duration-200"
          >
            Yes
          </button>
        </div>

      </div>
    </div>
  );
}
