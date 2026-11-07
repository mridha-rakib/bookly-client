"use client";

import React, { useState, useEffect } from "react";

// Simple right arrow icon if ArrowRight02Icon is not available
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dateStr: string) => void;
  initialDate?: string;
  timezone?: string;
}

function calendarDate(initialDate?: string, timezone?: string) {
  if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
    const [year, month, day] = initialDate.split("-").map(Number);
    return { year, month: month - 1, day };
  }
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (name: string) => Number(parts.find(value => value.type === name)?.value);
  return { year: part("year"), month: part("month") - 1, day: part("day") };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function DatePickerModal({
  isOpen,
  onClose,
  onSelect,
  initialDate,
  timezone,
}: DatePickerModalProps) {
  const [currentYear, setCurrentYear] = useState(() => calendarDate(initialDate, timezone).year);
  const [currentMonth, setCurrentMonth] = useState(() => calendarDate(initialDate, timezone).month);
  const [selectedDay, setSelectedDay] = useState(() => calendarDate(initialDate, timezone).day);

  useEffect(() => {
    if (!isOpen) return;
    const selected = calendarDate(initialDate, timezone);
    // This modal hydrates its editable date when opened, from the saved Business-local date.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCurrentYear(selected.year);
    setCurrentMonth(selected.month);
    setSelectedDay(selected.day);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialDate, isOpen, timezone]);

  if (!isOpen) return null;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  const changeMonth = (delta: number) => {
    const next = new Date(currentYear, currentMonth + delta, 1);
    setCurrentYear(next.getFullYear());
    setCurrentMonth(next.getMonth());
    setSelectedDay(Math.min(selectedDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  };
  const handlePrevMonth = () => changeMonth(-1);
  const handleNextMonth = () => changeMonth(1);

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
  };

  const handleAdd = () => {
    // Formats date as YYYY-MM-DD
    const pad = (num: number) => String(num).padStart(2, "0");
    const formattedDate = `${currentYear}-${pad(currentMonth + 1)}-${pad(selectedDay)}`;
    onSelect(formattedDate);
    onClose();
  };

  // Get weekday name and day display for the subheader (e.g. "Mon, Aug 17")
  const tempDate = new Date(currentYear, currentMonth, selectedDay);
  const weekdayStr = tempDate.toLocaleDateString("en-US", { weekday: "short" });
  const monthStr = tempDate.toLocaleDateString("en-US", { month: "short" });
  const subheaderDisplay = `${weekdayStr}, ${monthStr} ${selectedDay}`;

  // Generate calendar grid array
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(i);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 select-none font-poppins">
      {/* Modal Container */}
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[500px] md:max-w-[714px] flex flex-col p-6 md:p-10 gap-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        {/* Title */}
        <h2 className="text-sm md:text-base font-semibold tracking-widest text-[#1C1B1C] uppercase text-center w-full">
          Select Date
        </h2>

        {/* Local Selection Row */}
        <div className="flex flex-row justify-between items-center w-full px-2 border-b border-neutral-100 pb-2">
          {/* Month selector dropdown mock */}
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="font-poppins font-medium text-sm text-[#111111]">
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <span className="text-[10px] text-neutral-500">▼</span>
          </div>

          {/* Month Navigation Arrows */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-800 transition-colors"
            >
              <ArrowLeftIcon />
            </button>
            <button
              onClick={handleNextMonth}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-100 text-neutral-800 transition-colors"
            >
              <ArrowRightIcon />
            </button>
          </div>
        </div>

        {/* Large Date Display (Subheader) */}
        <div className="w-full text-left font-roboto text-3xl font-normal text-[#111111] py-2">
          {subheaderDisplay}
        </div>

        {/* Weekdays Header */}
        <div className="grid grid-cols-7 text-center w-full font-roboto font-normal text-sm text-[#111111] mb-2">
          {WEEKDAYS.map((day, idx) => (
            <div key={idx} className="h-10 flex items-center justify-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-y-2 text-center w-full">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-10 w-full" />;
            }

            const isSelected = day === selectedDay;
            // mock today's date highlight (let's say 17 is today's highlight)
            const isTodayHighlight = day === 17 && !isSelected;

            return (
              <div key={day} className="h-10 flex items-center justify-center relative">
                <button
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-roboto text-sm transition-all focus:outline-none ${
                    isSelected
                      ? "bg-black text-white font-medium"
                      : isTodayHighlight
                      ? "bg-[#D1D1D1] text-[#111111]"
                      : "text-[#111111] hover:bg-neutral-100"
                  }`}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-row justify-end items-center gap-3 w-full border-t border-neutral-100 pt-6 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-6 bg-white hover:bg-neutral-50 text-neutral-700 font-poppins font-medium text-xs rounded-lg border border-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="h-9 px-6 bg-[#5CAABF] hover:bg-[#4895a9] text-white font-poppins font-semibold text-xs rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

      </div>
    </div>
  );
}
