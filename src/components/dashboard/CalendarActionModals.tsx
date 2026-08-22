"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

// ----------------------------------------------------
// 1. No-Show Modal Component
// ----------------------------------------------------
interface NoShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function NoShowModal({ isOpen, onClose, onConfirm }: NoShowModalProps) {
  const [reason, setReason] = useState("Customer did not attend");
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!isOpen) return null;

  const reasons = [
    "Customer did not attend",
    "Customer unreachable",
    "Customer arrived but refused service",
    "Other"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[515px] h-[554px] bg-white rounded-[12px] shadow-2xl flex flex-col items-center p-4 gap-3 relative animate-fadeIn"
      >
        {/* Frame 2147228120 */}
        <div className="flex flex-col items-center p-0 gap-2 w-[483px] h-[148px] shrink-0">
          {/* btn / danger exclamation badge */}
          <div className="w-14 h-14 bg-[#26C08F] rounded-full flex items-center justify-center text-white text-[28px] font-medium font-poppins select-none shrink-0">
            !
          </div>

          {/* Title */}
          <h3 className="w-[483px] h-9 font-poppins font-medium text-[28px] leading-[36px] text-[#09090B] text-left">
            Start No-show timer?
          </h3>

          {/* Subtext */}
          <p className="w-[483px] h-10 font-poppins font-normal text-[14px] leading-[20px] tracking-[0.0025em] text-[#525252] text-left">
            A 90 min timer will start after you confirm. The customer&apos;s card will be charged after the timer expires — giving you time to reverse
          </p>
        </div>

        {/* Frame 2147240028 (Inputs wrapper) */}
        <div className="flex flex-col items-center p-0 gap-5 w-[483px] h-[306px] shrink-0 relative">
          {/* Reason Frame */}
          <div className="flex flex-col items-start p-0 gap-2 w-[483px] h-[76px] shrink-0 relative">
            <label className="w-[483px] h-[22px] font-poppins font-normal text-xs leading-[22px] text-[#111111] text-left">
              Reason (optional - internal only)
            </label>
            
            <div 
              onClick={() => setShowReasonDropdown(!showReasonDropdown)}
              className="box-border flex flex-row justify-between items-center p-3 gap-2.5 w-[483px] h-[46px] border border-[#111111]/60 rounded-[12px] bg-white cursor-pointer select-none"
            >
              <span className="font-poppins font-normal text-sm text-[#111111]">
                {reason}
              </span>
              <HugeiconsIcon 
                icon={ArrowDown01Icon} 
                className={`w-5 h-5 text-[#111111]/60 transition-transform duration-200 ${showReasonDropdown ? "rotate-180" : ""}`} 
              />
            </div>

            {showReasonDropdown && (
              <div className="absolute top-[78px] left-0 right-0 z-20 bg-white border border-[#111111]/30 rounded-[12px] shadow-xl py-1 flex flex-col max-h-[180px] overflow-y-auto">
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

          {/* Internal note Frame */}
          <div className="flex flex-col items-start p-0 gap-2 w-[483px] h-[210px] shrink-0">
            <label className="w-[483px] h-[22px] font-poppins font-normal text-xs leading-[22px] text-[#111111] text-left">
              Internal note (optional)
            </label>
            <textarea
              placeholder="Add a private note about this no-show..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="box-border w-[483px] h-[180px] border border-[#111111]/60 rounded-[12px] p-3 font-poppins font-normal text-sm text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:border-[#26C08F] resize-none"
            />
          </div>
        </div>

        {/* Buttons footer */}
        <div className="flex flex-row justify-end items-center p-0 gap-3 w-[483px] h-11 shrink-0 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="box-border flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[101px] h-11 bg-[#F1F1F2] border border-[#D3D3D6] shadow-[0px_0px_2px_rgba(62,62,68,0.2)] rounded-[12px] font-poppins font-medium text-sm text-[#3E3E44] tracking-[0.03em] hover:bg-[#E4E4E6] cursor-pointer transition-all duration-200"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[74px] h-11 bg-[#26C08F] hover:bg-[#1fa379] rounded-[12px] font-poppins font-medium text-sm text-white tracking-[0.03em] cursor-pointer transition-all duration-200"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. Complete Modal Component
// ----------------------------------------------------
/** The confirmed outcome of the "did the customer pay the remaining balance at venue" question
 * — server-authoritative fields only (never a display string) so the caller can call the real
 * completeBooking API directly. `amountCents` is present only when the Business is attesting a
 * SPECIFIC amount was collected; when omitted with `paid: true`, the backend defaults to the
 * booking's own snapshotted `balanceDueCents` (see api/.../booking-lifecycle.service.ts
 * completeBooking's own doc comment). */
export type CompleteModalVenuePayment = { paid: boolean; amountCents?: number; note?: string };

interface CompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (venuePayment: CompleteModalVenuePayment) => void;
  /** The snapshotted remaining balance (integer cents) this booking has due at the venue —
   * server-authoritative, drives the default "Yes - customer paid €X at venue" option text.
   * When omitted, that option is hidden and only the manual-amount/no-payment options show. */
  defaultBalanceDueCents?: number;
  currencySymbol?: string;
}

export function CompleteModal({
  isOpen,
  onClose,
  onConfirm,
  defaultBalanceDueCents,
  currencySymbol = "€",
}: CompleteModalProps) {
  const formattedDefault =
    defaultBalanceDueCents !== undefined ? (defaultBalanceDueCents / 100).toFixed(2) : undefined;
  const payOptions = [
    ...(formattedDefault !== undefined
      ? [`Yes - customer paid ${currencySymbol}${formattedDefault} at venue`]
      : []),
    "Yes - customer paid other amount",
    "No - customer has not paid remaining balance",
  ];
  const [payValue, setPayValue] = useState(payOptions[0] ?? "No - customer has not paid remaining balance");
  const [showPayDropdown, setShowPayDropdown] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [otherAmount, setOtherAmount] = useState("");

  if (!isOpen) return null;

  const isOtherAmount = payValue === "Yes - customer paid other amount";

  const handleConfirm = () => {
    const note = internalNote.trim() || undefined;
    if (payValue === "No - customer has not paid remaining balance") {
      onConfirm({ paid: false, note });
      return;
    }
    if (isOtherAmount) {
      const parsed = Math.round(Number.parseFloat(otherAmount) * 100);
      onConfirm({ paid: true, amountCents: Number.isFinite(parsed) && parsed > 0 ? parsed : 0, note });
      return;
    }
    // The default-balance option — let the backend apply the server-snapshotted amount.
    onConfirm({ paid: true, note });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[361px] bg-white rounded-xl shadow-2xl flex flex-col items-center p-4 gap-3 relative animate-fadeIn"
      >
        <div className="flex flex-col items-center p-0 gap-2 w-[329px]">
          {/* Green Check Badge */}
          <div className="w-14 h-14 bg-[#1D9E75] rounded-full flex items-center justify-center text-white text-[28px] font-medium font-poppins select-none shrink-0">
            ✓
          </div>

          {/* Title */}
          <h3 className="w-[329px] font-poppins font-medium text-[28px] leading-[36px] text-[#09090B] text-center">
            Are you sure you want to complete the booking?
          </h3>

          {/* Subtext */}
          <p className="w-[329px] font-poppins font-normal text-[14px] leading-[20px] text-[#525252] text-center">
            If you mark it as yes then customer did show up and take the service from you
          </p>
        </div>

        {/* Inputs */}
        <div className="flex flex-col items-center p-0 gap-4 w-[329px] relative">
          {/* Dropdown */}
          <div className="flex flex-col items-start p-0 gap-2 w-[329px] relative">
            <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
              Did the customer pay the remaining balance at venue
            </label>
            
            <div 
              onClick={() => setShowPayDropdown(!showPayDropdown)}
              className="box-border flex flex-row justify-between items-center p-3 gap-2.5 w-[329px] h-[46px] border border-[#111111]/60 rounded-xl bg-white cursor-pointer select-none"
            >
              <span className="font-poppins font-normal text-sm text-[#111111] truncate">
                {payValue}
              </span>
              <HugeiconsIcon icon={ArrowDown01Icon} className={`w-5 h-5 text-[#111111]/60 transition-transform duration-200 ${showPayDropdown ? "rotate-180" : ""}`} />
            </div>

            {showPayDropdown && (
              <div className="absolute top-[78px] left-0 right-0 z-10 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 flex flex-col max-h-[180px] overflow-y-auto">
                {payOptions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPayValue(item);
                      setShowPayDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-neutral-50 font-poppins text-sm text-[#111111] transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual amount — only shown for the "other amount" option, a genuinely necessary
              addition to make that already-designed option functional (see CompleteModalVenuePayment
              doc comment: the server never trusts this beyond it being the Business's own
              off-platform attestation). */}
          {isOtherAmount && (
            <div className="flex flex-col items-start p-0 gap-2 w-[329px]">
              <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
                Amount paid at venue ({currencySymbol})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherAmount}
                onChange={(e) => setOtherAmount(e.target.value)}
                placeholder="0.00"
                className="box-border w-[329px] h-[46px] border border-[#111111]/60 rounded-xl p-3 gap-2.5 font-poppins font-normal text-sm text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:border-green-500"
              />
            </div>
          )}

          {/* Internal note */}
          <div className="flex flex-col items-start p-0 gap-2 w-[329px]">
            <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
              Internal note (optional)
            </label>
            <textarea
              placeholder="Add a private note about this no-show..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="box-border w-[329px] h-[120px] border border-[#111111]/60 rounded-xl p-3 gap-2.5 font-poppins font-normal text-sm text-[#111111] placeholder-[#111111]/40 focus:outline-none focus:border-green-500 resize-none"
            />
          </div>
        </div>

        {/* Buttons footer */}
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
            onClick={handleConfirm}
            className="flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[74px] h-11 bg-[#1D9E75] hover:bg-[#157A5A] rounded-xl font-poppins font-medium text-sm text-white tracking-[0.03em] cursor-pointer transition-all duration-200"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. Cancel Booking Modal Component
// ----------------------------------------------------
interface CancelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `reason` is one of the fixed dropdown options above (server does not further validate its
   * content beyond required-non-empty); `internalNote` is optional free text. Matches
   * bookingsApi.cancelByBusiness's own `reason` parameter. */
  onConfirm: (reason: string, internalNote?: string) => void;
}

export function CancelBookingModal({ isOpen, onClose, onConfirm }: CancelBookingModalProps) {
  const [cancelReason, setCancelReason] = useState("Service is not available");
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [internalNote, setInternalNote] = useState("");

  if (!isOpen) return null;

  const cancelReasons = [
    "Service is not available",
    "Staff emergency",
    "Double booked",
    "Customer requested",
    "Other reason"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none font-poppins">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-[361px] bg-white rounded-xl shadow-2xl flex flex-col items-center p-4 gap-3 relative animate-fadeIn"
      >
        <div className="flex flex-col items-center p-0 gap-2 w-[329px]">
          {/* Red Exclamation Badge */}
          <div className="w-14 h-14 bg-[#D44343] rounded-full flex items-center justify-center text-white text-[28px] font-medium font-poppins select-none shrink-0">
            !
          </div>

          {/* Title */}
          <h3 className="w-[329px] font-poppins font-medium text-[28px] leading-[36px] text-[#09090B] text-center">
            Are you sure you want to cancel the booking?
          </h3>

          {/* Subtext */}
          <p className="w-[329px] font-poppins font-normal text-[14px] leading-[20px] text-[#525252] text-center">
            Since you are canceling the booking, customer do not need to pay you anymore
          </p>
        </div>

        {/* Inputs */}
        <div className="flex flex-col items-center p-0 gap-4 w-[329px] relative">
          {/* Dropdown */}
          <div className="flex flex-col items-start p-0 gap-2 w-[329px] relative">
            <label className="w-[329px] font-poppins font-normal text-[12px] leading-[22px] text-[#111111]">
              Reason (required)
            </label>
            
            <div 
              onClick={() => setShowReasonDropdown(!showReasonDropdown)}
              className="box-border flex flex-row justify-between items-center p-3 gap-2.5 w-[329px] h-[46px] border border-[#111111]/60 rounded-xl bg-white cursor-pointer select-none"
            >
              <span className="font-poppins font-normal text-sm text-[#111111] truncate">
                {cancelReason}
              </span>
              <HugeiconsIcon icon={ArrowDown01Icon} className={`w-5 h-5 text-[#111111]/60 transition-transform duration-200 ${showReasonDropdown ? "rotate-180" : ""}`} />
            </div>

            {showReasonDropdown && (
              <div className="absolute top-[78px] left-0 right-0 z-10 bg-white border border-neutral-200 rounded-xl shadow-xl py-1 flex flex-col max-h-[180px] overflow-y-auto">
                {cancelReasons.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCancelReason(item);
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

          {/* Internal note */}
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

        {/* Buttons footer */}
        <div className="flex flex-row justify-end items-center p-0 gap-3 w-[329px] mt-1">
          <button
            type="button"
            onClick={onClose}
            className="box-border flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[101px] h-11 bg-[#F1F1F2] border border-[#D3D3D6] shadow-[0px_0px_2px_rgba(62,62,68,0.2)] rounded-xl font-poppins font-medium text-sm text-[#3E3E44] tracking-[0.03em] hover:bg-[#E4E4E6] cursor-pointer transition-all duration-200"
          >
            No
          </button>
          
          <button
            type="button"
            onClick={() => onConfirm(cancelReason, internalNote.trim() || undefined)}
            className="flex flex-row justify-center items-center px-6 py-3.5 gap-2 w-[74px] h-11 bg-[#D44343] hover:bg-red-700 rounded-xl font-poppins font-medium text-sm text-white tracking-[0.03em] cursor-pointer transition-all duration-200"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
