"use client";

import React from "react";
import { formatTime12Hour } from "@/lib/staff/format";

interface OpeningHoursSectionProps {
  days: any[];
  toggleDay: (idx: number) => void;
  updateSlotTime: (dayIdx: number, slotIdx: number, field: "start" | "end", val: string) => void;
  addTimeSlot: (dayIdx: number) => void;
  removeTimeSlot: (dayIdx: number, slotIdx: number) => void;
  timeOptions: string[];
}

export default function OpeningHoursSection({
  days,
  toggleDay,
  updateSlotTime,
  addTimeSlot,
  removeTimeSlot,
  timeOptions
}: OpeningHoursSectionProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
        Opening Hours
      </span>
      <p className="text-[11px] text-neutral-500 -mt-1 mb-2">
        Set your regular weekly schedule. These are displayed on your marketplace profile but do not affect your scheduled shifts
      </p>

      <div className="flex flex-col gap-11 py-5 max-w-[651.52px] w-full select-none">
        {days.map((day, dayIdx) => (
          <div key={day.name} className="flex flex-col sm:flex-row items-start gap-3 sm:gap-6 w-full min-h-[53px]">
            {/* Checkbox and Day/Status Container */}
            <div className="flex flex-row items-start gap-3.5 w-full sm:w-[196px] shrink-0 pt-0.5">
              {/* Custom Checkbox */}
              <button
                type="button"
                onClick={() => toggleDay(dayIdx)}
                className={`w-[27px] h-[27px] rounded-[5px] flex items-center justify-center transition-colors shrink-0 ${
                  day.open
                    ? "bg-[#2E9DA7] text-white"
                    : "bg-white border border-[#D7D7D7]"
                }`}
              >
                {day.open && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              {/* Day and Status */}
              <div className="flex flex-col items-start gap-1">
                <span className="font-inter font-normal text-[17px] text-[#232326] leading-[20px] tracking-[-0.255px]">
                  {day.name}
                </span>
                {day.open && (
                  <span className="font-inter font-normal text-[17px] text-[#478F2F] leading-[18px] tracking-[-0.17px]">
                    Open
                  </span>
                )}
              </div>
            </div>

            {/* Slots display */}
            {day.open ? (
              <div className="w-full sm:flex-1 flex flex-col gap-3.5">
                {day.slots.map((slot: any, slotIdx: number) => (
                  <div key={slotIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-[17px] w-full">
                    {/* Start time Custom Select */}
                    <div className="relative w-[166px] h-[53px] shrink-0">
                      <select
                        value={slot.start}
                        onChange={(e) => updateSlotTime(dayIdx, slotIdx, "start", e.target.value)}
                        className="appearance-none w-[166px] h-[53px] bg-white border border-[#D7D7D7] rounded-lg px-[18px] font-inter font-normal text-[18px] text-[#2F3033] leading-[27px] tracking-[-0.18px] focus:outline-none cursor-pointer pr-[36px]"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='19' height='19' viewBox='0 0 24 24' fill='none' stroke='%231D2227' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 18px center',
                          backgroundSize: '14px'
                        }}
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>{formatTime12Hour(t)}</option>
                        ))}
                      </select>
                    </div>

                    <span className="font-inter font-normal text-[18px] text-[#888888] leading-[27px] select-none shrink-0 w-[18px] text-center">to</span>

                    {/* End time Custom Select */}
                    <div className="relative w-[166px] h-[53px] shrink-0">
                      <select
                        value={slot.end}
                        onChange={(e) => updateSlotTime(dayIdx, slotIdx, "end", e.target.value)}
                        className="appearance-none w-[166px] h-[53px] bg-white border border-[#D7D7D7] rounded-lg px-[18px] font-inter font-normal text-[18px] text-[#2F3033] leading-[27px] tracking-[-0.18px] focus:outline-none cursor-pointer pr-[36px]"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='19' height='19' viewBox='0 0 24 24' fill='none' stroke='%231D2227' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 18px center',
                          backgroundSize: '14px'
                        }}
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>{formatTime12Hour(t)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Actions column */}
                    <div className="flex items-center justify-center pl-1.5 w-[32px] h-[26px]">
                      {/* Delete Slot Button */}
                      {day.slots.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(dayIdx, slotIdx)}
                          className="text-[#E94B5C] hover:opacity-80 flex items-center justify-center w-full h-full"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      ) : (
                        /* Add Slot Button (only show next to first slot) */
                        slotIdx === 0 && (
                          <button
                            type="button"
                            onClick={() => addTimeSlot(dayIdx)}
                            className="text-[#1F2428] hover:opacity-80 flex items-center justify-center w-full h-full"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-grow min-h-[53px]"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
