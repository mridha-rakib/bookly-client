"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CheckListIcon as ListChecksIcon } from "@hugeicons/core-free-icons";

import { toast } from "@/components/ui/sonner";
import type { DayOfWeek } from "@/lib/api/staff";
import type { ServiceScheduleMode } from "@/lib/api/services";
import {
  dayOrder,
  formatTime12Hour,
  parseTime12HourToCanonical,
  parseTimeInputText,
  sanitizeTimeDraftInput
} from "@/lib/staff/format";

/**
 * The single implementation of the per-weekday manual-schedule editor and its AUTO
 * booking-interval control — used by ServiceForm (Services → Add/Edit Service) and by
 * Business Profile's Booking Time Control, so the two screens can never drift on how a
 * manual schedule is parsed, validated, or persisted. Never owns API persistence — the
 * parent supplies the current draft and receives the updated draft back on every edit.
 */

export type ManualDayState = {
  isOpen: boolean;
  slots: string[]; // canonical "HH:mm"
  newTimeText: string;
  amPm: "AM" | "PM";
};

export const emptyDay = (): ManualDayState => ({ isOpen: false, slots: [], newTimeText: "", amPm: "AM" });

export const buildEmptyManualSchedule = (): Record<DayOfWeek, ManualDayState> =>
  Object.fromEntries(dayOrder.map((day) => [day, emptyDay()])) as Record<DayOfWeek, ManualDayState>;

/** Pure — parses `dayState.newTimeText`/`amPm` into a canonical time and returns the day
 * state it produces, or an error message when the typed text isn't a valid time. Adding an
 * already-present time is a no-op (just clears the draft input), matching the previous
 * inline ServiceForm behavior exactly. */
export const withManualTimeAdded = (dayState: ManualDayState): { next: ManualDayState; error?: string } => {
  const parsed = parseTimeInputText(dayState.newTimeText);
  if (!parsed) {
    return { next: dayState, error: "Enter a valid time as H:MM" };
  }
  const canonical = parseTime12HourToCanonical(parsed.hour, parsed.minute, dayState.amPm);
  if (dayState.slots.includes(canonical)) {
    return { next: { ...dayState, newTimeText: "" } };
  }
  return { next: { ...dayState, slots: [...dayState.slots, canonical].sort(), newTimeText: "" } };
};

export const withManualTimeRemoved = (dayState: ManualDayState, time: string): ManualDayState => ({
  ...dayState,
  slots: dayState.slots.filter((slot) => slot !== time)
});

export interface ServiceBookingIntervalField {
  /** Raw minutes text as typed; empty string means "use the default (service duration)". */
  value: string;
  onChange: (value: string) => void;
  /** The Service's own duration, shown as the effective value when `value` is empty —
   * mirrors AvailabilityService's own fallback (`bookingIntervalMin ?? durationMin`),
   * never persists a value merely from being displayed. */
  durationMin: number;
  error?: string;
  disabled?: boolean;
}

export interface ServiceScheduleEditorProps {
  scheduleMode: ServiceScheduleMode;
  manualSchedule: Record<DayOfWeek, ManualDayState>;
  onManualScheduleChange: (next: Record<DayOfWeek, ManualDayState>) => void;
  manualScheduleError?: string;
  disabled?: boolean;
  /** Present only where an AUTO booking-interval control should render (Business Profile).
   * Omit to match ServiceForm's existing behavior, where the interval lives in the pricing
   * grid instead — passing it there would duplicate that field, not add a new one. */
  bookingInterval?: ServiceBookingIntervalField;
}

export default function ServiceScheduleEditor({
  scheduleMode,
  manualSchedule,
  onManualScheduleChange,
  manualScheduleError,
  disabled,
  bookingInterval
}: ServiceScheduleEditorProps) {
  const setDay = (day: DayOfWeek, patch: Partial<ManualDayState>) => {
    onManualScheduleChange({ ...manualSchedule, [day]: { ...manualSchedule[day], ...patch } });
  };

  const handleAddManualTime = (day: DayOfWeek) => {
    const { next, error } = withManualTimeAdded(manualSchedule[day]);
    if (error) {
      toast.error(error);
      return;
    }
    setDay(day, next);
  };

  const handleRemoveManualTime = (day: DayOfWeek, time: string) => {
    setDay(day, withManualTimeRemoved(manualSchedule[day], time));
  };

  if (scheduleMode === "MANUAL") {
    return (
      <div className="box-sizing-border-box flex flex-col items-start p-[24px] bg-white border border-[#10745B]/10 rounded-[18px] w-full shadow-[0px_0px_0px_3px_rgba(16,116,91,0.08)]">
        <div className="flex flex-row items-start gap-[16px] w-full">
          <div className="w-[44px] h-[44px] bg-[#D1F3FA] rounded-full flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={ListChecksIcon} className="w-5 h-5 text-[#106374]" />
          </div>
          <div className="flex flex-col">
            <span className="font-poppins font-medium text-[17px] leading-[26px] tracking-[-0.34px] text-[#1F201D]">
              Fixed time slots
            </span>
            <span className="font-poppins font-normal text-[14px] leading-[20px] text-[#6D6D68]">
              Define the exact times customers can book this service. Only these times will appear.
            </span>
          </div>
        </div>

        <div className="w-full border-b border-neutral-100 my-4" />
        <span className="font-poppins font-medium text-[13px] leading-[20px] text-[#3D3E39] mb-4">
          Available times
        </span>
        {manualScheduleError && <span className="text-xs text-[#D85A30] mb-2">{manualScheduleError}</span>}

        <div className="flex flex-col gap-6 w-full">
          {dayOrder.map((day) => {
            const dayState = manualSchedule[day];
            const dayLabel = day.charAt(0) + day.slice(1).toLowerCase();
            return (
              <div key={day} className="flex flex-col sm:flex-row gap-5 w-full items-start border-b border-neutral-100/50 pb-4">
                <div className="flex flex-row items-center gap-3 w-[196px] pt-2 shrink-0">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setDay(day, { isOpen: !dayState.isOpen })}
                    className={`w-[27px] h-[27px] rounded-[5px] flex items-center justify-center transition-colors ${
                      dayState.isOpen ? "bg-[#2E9DA7]" : "border border-[#C6C19F] bg-white"
                    } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {dayState.isOpen && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex flex-col">
                    <span className="font-inter font-normal text-[17px] leading-[20px] tracking-[-0.255px] text-[#232326]">
                      {dayLabel}
                    </span>
                    {dayState.isOpen && (
                      <span className="font-inter font-normal text-[17px] leading-[18px] tracking-[-0.17px] text-[#478F2F]">
                        Open
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`flex-1 flex flex-col gap-3 w-full transition-opacity duration-200 ${
                    !dayState.isOpen ? "opacity-25 pointer-events-none" : ""
                  }`}
                >
                  <div className="flex flex-row flex-wrap gap-2.5 items-center w-full">
                    <div className="box-sizing-border-box flex flex-row justify-between items-center p-[6px] bg-[#FBFAF8] border border-[#DEDBD3] rounded-[16px] flex-1 max-w-[300px] h-[38px] sm:h-[46px] shrink-0">
                      <input
                        type="text"
                        disabled={!dayState.isOpen || disabled}
                        value={dayState.newTimeText}
                        onChange={(e) => setDay(day, { newTimeText: sanitizeTimeDraftInput(e.target.value) })}
                        placeholder="9:00"
                        className="font-poppins font-medium text-sm sm:text-[17px] leading-[20px] sm:leading-[26px] tracking-[-0.34px] text-black bg-transparent w-16 sm:w-20 text-center focus:outline-none"
                      />
                      <div className="flex flex-row gap-0.5 sm:gap-1">
                        <button
                          type="button"
                          disabled={!dayState.isOpen || disabled}
                          onClick={() => setDay(day, { amPm: "AM" })}
                          className={`px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-medium ${
                            dayState.amPm === "AM" ? "bg-[#8EBAC5] text-[#111111]" : "text-neutral-500"
                          }`}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          disabled={!dayState.isOpen || disabled}
                          onClick={() => setDay(day, { amPm: "PM" })}
                          className={`px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-medium ${
                            dayState.amPm === "PM" ? "bg-[#8EBAC5] text-[#111111]" : "text-neutral-500"
                          }`}
                        >
                          PM
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!dayState.isOpen || disabled}
                      onClick={() => handleAddManualTime(day)}
                      className="w-9 h-9 border border-[#C6C6CB] bg-white rounded-full flex items-center justify-center hover:bg-neutral-50 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                    >
                      <span className="text-xl font-medium text-[#141B34]">+</span>
                    </button>
                  </div>

                  {dayState.isOpen && dayState.slots.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dayState.slots.map((slot) => (
                        <div
                          key={slot}
                          className="flex items-center gap-2 px-3 py-1 bg-[#D1F3FA] rounded-full text-xs font-poppins font-medium text-[#106374]"
                          title={formatTime12Hour(slot)}
                        >
                          <span>{formatTime12Hour(slot)}</span>
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => handleRemoveManualTime(day, slot)}
                              className="text-[#106374] font-bold hover:text-red-500"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (bookingInterval) {
    const effectiveMinutes = bookingInterval.value.trim() ? bookingInterval.value.trim() : String(bookingInterval.durationMin);
    return (
      <div className="flex flex-col gap-2 w-full">
        <span className="font-poppins font-normal text-[12px] leading-[18px] text-[#111111]">Booking interval (min)</span>
        <span className="font-poppins font-normal text-xs text-[#111111]/60">
          How often a new slot start appears — not the appointment length.
        </span>
        <input
          type="text"
          inputMode="numeric"
          disabled={bookingInterval.disabled || disabled}
          value={bookingInterval.value}
          onChange={(e) => bookingInterval.onChange(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={`Default (same as service duration — ${bookingInterval.durationMin} min)`}
          className="h-[41px] bg-white border border-[#D3D1C7] rounded-[12px] px-3 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus:outline-none w-full max-w-[280px] disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-neutral-500">Effective value: {effectiveMinutes} min</span>
        {bookingInterval.error && <span className="text-xs text-[#D85A30]">{bookingInterval.error}</span>}
      </div>
    );
  }

  return null;
}
