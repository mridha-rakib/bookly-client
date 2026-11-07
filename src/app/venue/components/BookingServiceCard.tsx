"use client";

import type { ReactNode } from "react";

/** The Venue service row and its Book/selected toggle, shared by every Booking type. */
export default function BookingServiceCard({ name, selected, onToggle, disabled, children }: {
  name: string; selected: boolean; onToggle: () => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <div className={`w-full bg-white border rounded-xl p-5 flex justify-between items-center gap-4 shadow-sm transition-all ${selected ? "border-[#2BB54F]" : "border-[#E5E5E5]"}`}>
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={selected ? `Selected ${name}` : `Book ${name}`}
        className={`text-sm font-semibold rounded-full border transition-all duration-200 ease-out cursor-pointer shadow-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${selected
          ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 rounded-full aspect-square"
          : "bg-[#FCFAF9] border-[#B3B3B3] text-[#0D0D0D] [@media(hover:hover)]:hover:bg-[#0D0D0D] [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:border-[#0D0D0D] [@media(hover:hover)]:hover:shadow-md [@media(hover:hover)]:motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95 motion-safe:active:translate-y-0 px-5 py-2"
        }`}
      >
        {selected ? (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : "Book"}
      </button>
    </div>
  );
}

/** The Venue hours/person stepper. */
export function QuantityStepper({ label, value, onDecrement, onIncrement, canDecrement = true, canIncrement = true }: {
  label: string; value: ReactNode; onDecrement: () => void; onIncrement: () => void;
  canDecrement?: boolean; canIncrement?: boolean;
}) {
  const button = "px-3 min-w-10 h-full hover:bg-neutral-100 font-bold border-neutral-300 text-lg disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-3 mt-2">
      <span className="text-sm font-semibold text-[#0d0d0d] font-poppins">{label}</span>
      <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-10 bg-[#FCFAF9]">
        <button type="button" aria-label={`Decrease ${label}`} disabled={!canDecrement} onClick={onDecrement} className={`${button} border-r`}>-</button>
        <span className="px-4 font-semibold font-poppins text-sm text-[#111111]">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} disabled={!canIncrement} onClick={onIncrement} className={`${button} border-l`}>+</button>
      </div>
    </div>
  );
}
