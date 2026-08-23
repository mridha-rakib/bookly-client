"use client";

import React, { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon, Clock04Icon } from "@hugeicons/core-free-icons";

import type { AvailabilityResult, AvailabilitySlot } from "@/lib/api/catalog";

interface TimeStepProps {
  timezone: string;
  visibleMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  availability?: AvailabilityResult;
  isLoading?: boolean;
  selectedDateIso?: string;
  onSelectDate: (dateIso: string) => void;
  selectedSlot?: AvailabilitySlot;
  onSelectSlot: (slot: AvailabilitySlot) => void;
}

const toDateIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatLocalTime = (isoInstant: string, timezone: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }).format(
    new Date(isoInstant),
  );

/** The Business's own local hour-of-day for a slot — never UTC (a slot at 09:00 local in a
 * UTC+2 business is 07:00 UTC; splitting on raw UTC hours would misclassify it). */
const localHour = (isoInstant: string, timezone: string): number =>
  Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: timezone }).format(
      new Date(isoInstant),
    ),
  );

export default function TimeStep({
  timezone,
  visibleMonth,
  onPrevMonth,
  onNextMonth,
  availability,
  isLoading,
  selectedDateIso,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
}: TimeStepProps) {
  const todayIso = toDateIso(new Date());

  const weeks = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Monday-first grid: JS getDay() is 0=Sun..6=Sat; convert to 0=Mon..6=Sun.
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ date: Date; dateIso: string } | null> = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push({ date, dateIso: toDateIso(date) });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: Array<typeof cells> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [visibleMonth]);

  const dayByIso = useMemo(() => {
    const map = new Map<string, (typeof availability extends undefined ? never : NonNullable<typeof availability>["days"][number])>();
    for (const day of availability?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [availability]);

  const selectedDay = selectedDateIso ? dayByIso.get(selectedDateIso) : undefined;
  const morningSlots = (selectedDay?.slots ?? []).filter(
    (slot) => localHour(slot.startAt, timezone) < 12,
  );
  const afternoonSlots = (selectedDay?.slots ?? []).filter(
    (slot) => localHour(slot.startAt, timezone) >= 12,
  );

  const renderSlotButton = (slot: AvailabilitySlot) => {
    const isSelected = selectedSlot?.startAt === slot.startAt;
    return (
      <button
        key={slot.startAt}
        onClick={() => onSelectSlot(slot)}
        className={`py-3 border rounded-lg text-sm font-semibold transition-all cursor-pointer ${
          isSelected ? "bg-black border-black text-white" : "border-neutral-200 text-[#111111] hover:bg-neutral-50"
        }`}
      >
        {formatLocalTime(slot.startAt, timezone)}
      </button>
    );
  };

  return (
    <div className="flex flex-col w-full lg:w-[714px]">
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Select Time</h1>

      {/* Date Picker Section */}
      <div className="w-full bg-white border border-[#EBEAE6] rounded-2xl p-6 mt-[60px] shadow-sm">
        <div className="flex justify-between items-center w-full mb-6 px-1">
          <span className="font-semibold text-[17.5px] text-[#0A0D14] font-poppins">
            {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrevMonth}
              className="w-10 h-10 border border-[#E0DED9] rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-50 text-[#141B34]"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} />
            </button>
            <button
              onClick={onNextMonth}
              className="w-10 h-10 border border-[#E0DED9] rounded-lg flex items-center justify-center cursor-pointer hover:bg-neutral-50 text-[#141B34]"
            >
              <HugeiconsIcon icon={ArrowRight02Icon} size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3 w-full text-center">
          {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
            <span key={day} className="text-xs font-semibold text-[#8C8A85] tracking-widest py-1 font-poppins uppercase">
              {day}
            </span>
          ))}

          {weeks.flat().map((cell, idx) => {
            if (!cell) {
              return <div key={`blank-${idx}`} className="aspect-square" />;
            }
            const day = dayByIso.get(cell.dateIso);
            const isSelected = selectedDateIso === cell.dateIso;
            const isToday = cell.dateIso === todayIso;
            const isPast = cell.dateIso < todayIso;
            const hasSlots = (day?.slots.length ?? 0) > 0;
            const isBookable = !isPast && (day === undefined || day.isOpen);

            return (
              <button
                key={cell.dateIso}
                disabled={isPast || (day !== undefined && !hasSlots)}
                onClick={() => onSelectDate(cell.dateIso)}
                className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all border ${
                  isSelected
                    ? "bg-[#2E9DA7] border-[#2E9DA7] text-white"
                    : isToday
                      ? "bg-[#D1D1D1] border-neutral-300 text-black hover:bg-neutral-200"
                      : isPast || !isBookable
                        ? "bg-transparent border-transparent text-neutral-300 cursor-not-allowed"
                        : day !== undefined && !hasSlots
                          ? "bg-neutral-50 border-transparent text-neutral-300 cursor-not-allowed"
                          : "bg-transparent border-transparent text-[#0A0D14] hover:bg-neutral-50 cursor-pointer"
                }`}
              >
                <span>{cell.date.getDate()}</span>
                {isToday && (
                  <span className="text-[9px] mt-0.5 font-bold uppercase tracking-tighter opacity-80">TODAY</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots Section */}
      <div className="w-full flex flex-col gap-8 mt-[65px]">
        <h3 className="font-semibold text-[22px] text-[#111111] font-poppins">Select Time Slot</h3>

        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading availability…</p>
        ) : !selectedDateIso ? (
          <p className="text-sm text-neutral-500">Pick a date above to see available times.</p>
        ) : (selectedDay?.slots.length ?? 0) === 0 ? (
          <p className="text-sm text-neutral-500">No times are available on this date. Try another day.</p>
        ) : (
          <div className="flex flex-col gap-7 w-full">
            {morningSlots.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 font-poppins uppercase tracking-widest">
                  <HugeiconsIcon icon={Clock04Icon} size={18} />
                  <span>Morning</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full font-inter">
                  {morningSlots.map(renderSlotButton)}
                </div>
              </div>
            )}

            {afternoonSlots.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 font-poppins uppercase tracking-widest">
                  <HugeiconsIcon icon={Clock04Icon} size={18} />
                  <span>Afternoon</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full font-inter">
                  {afternoonSlots.map(renderSlotButton)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
