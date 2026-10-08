"use client";

import React, { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Clock04Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";

import type {
  AvailabilityBlockedSlot,
  AvailabilityResult,
  AvailabilitySlot,
} from "@/lib/api/catalog";
import { formatBookingTime } from "@/lib/bookings/format";

interface TimeStepProps {
  timezone: string;
  visibleMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  availability?: AvailabilityResult;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  selectedDateIso?: string;
  onSelectDate: (dateIso: string) => void;
  selectedSlot?: AvailabilitySlot;
  onSelectSlot: (slot: AvailabilitySlot) => void;
}

const toDateIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
  isError,
  onRetry,
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
  const hasBookableDates = (availability?.days ?? []).some((day) => day.slots.length > 0);
  const displayedSlots: Array<AvailabilitySlot | AvailabilityBlockedSlot> = [
    ...(selectedDay?.slots ?? []),
    ...(selectedDay?.blockedSlots ?? []),
  ].sort((left, right) => left.startAt.localeCompare(right.startAt));
  const morningSlots = displayedSlots.filter(
    (slot) => localHour(slot.startAt, timezone) < 12,
  );
  const afternoonSlots = displayedSlots.filter(
    (slot) => localHour(slot.startAt, timezone) >= 12,
  );

  const renderSlotButton = (slot: AvailabilitySlot | AvailabilityBlockedSlot) => {
    const timeLabel = formatBookingTime(slot.startAt, timezone);
    if ("status" in slot) {
      return (
        <button
          type="button"
          key={slot.startAt}
          disabled
          aria-label={`${timeLabel}, Booked`}
          className="flex cursor-not-allowed flex-col items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 py-2 text-neutral-400"
        >
          <span className="text-sm font-semibold">{timeLabel}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide">Booked</span>
        </button>
      );
    }

    const isSelected = selectedSlot?.startAt === slot.startAt;
    return (
      <button
        type="button"
        key={slot.startAt}
        onClick={() => onSelectSlot(slot)}
        aria-pressed={isSelected}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border py-3 text-sm font-semibold transition-all ${
          isSelected ? "bg-black border-black text-white" : "border-neutral-200 text-[#111111] hover:bg-neutral-50"
        }`}
      >
        <span>{formatBookingTime(slot.startAt, timezone)}</span>
        {isSelected ? <HugeiconsIcon icon={Tick01Icon} size={15} aria-hidden="true" /> : null}
      </button>
    );
  };

  return (
    <div className="flex w-full max-w-[714px] min-w-0 flex-col">
      <h1 className="text-2xl font-semibold text-[#1C1B1C] sm:text-3xl md:text-4xl">Select Time</h1>

      {/* Date Picker Section */}
      <div className="mt-6 w-full rounded-2xl border border-[#EBEAE6] bg-white p-3 shadow-sm sm:mt-10 sm:p-4 md:p-6 lg:mt-[60px]">
        <div className="mb-4 flex w-full items-center justify-between gap-3 px-1 sm:mb-6">
          <span className="font-poppins text-base font-semibold text-[#0A0D14] sm:text-[17.5px]">
            {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(visibleMonth)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevMonth}
              aria-label="Show previous month"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E0DED9] text-[#141B34] hover:bg-neutral-50 sm:h-10 sm:w-10"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={20} />
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              aria-label="Show next month"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#E0DED9] text-[#141B34] hover:bg-neutral-50 sm:h-10 sm:w-10"
            >
              <HugeiconsIcon icon={ArrowRight02Icon} size={20} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <p role="status" className="mb-3 rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#5F5E5A]">
            Loading availability…
          </p>
        ) : isError ? (
          <div role="alert" className="mb-3 flex flex-col gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>We couldn&apos;t load availability. Try again.</span>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="w-fit font-semibold underline">
                Retry
              </button>
            ) : null}
          </div>
        ) : availability && !hasBookableDates ? (
          <p className="mb-3 rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#5F5E5A]">
            No available dates this month. Try another month.
          </p>
        ) : null}

        <div className={`grid w-full grid-cols-7 gap-1 text-center min-[375px]:gap-2 sm:gap-3 ${isLoading ? "opacity-60" : ""}`}>
          {[
            ["M", "MON"],
            ["T", "TUE"],
            ["W", "WED"],
            ["T", "THU"],
            ["F", "FRI"],
            ["S", "SAT"],
            ["S", "SUN"],
          ].map(([shortDay, fullDay], index) => (
            <span key={`${fullDay}-${index}`} className="py-1 font-poppins text-[10px] font-semibold uppercase tracking-wide text-[#8C8A85] sm:text-xs sm:tracking-widest">
              <span className="sm:hidden">{shortDay}</span>
              <span className="hidden sm:inline">{fullDay}</span>
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
            const isBookable = Boolean(!isLoading && !isError && day?.isOpen && hasSlots);

            return (
              <button
                key={cell.dateIso}
                type="button"
                disabled={isPast || !isBookable}
                onClick={() => onSelectDate(cell.dateIso)}
                className={`flex aspect-square min-w-0 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition-all sm:rounded-xl sm:text-sm ${
                  isSelected
                    ? "bg-[#2E9DA7] border-[#2E9DA7] text-white"
                    : isToday
                      ? "bg-[#D1D1D1] border-neutral-300 text-black hover:bg-neutral-200"
                      : isPast || !isBookable
                        ? "cursor-not-allowed border-transparent bg-transparent text-neutral-300"
                        : "cursor-pointer border-transparent bg-transparent text-[#0A0D14] hover:bg-neutral-50"
                }`}
              >
                <span>{cell.date.getDate()}</span>
                {isToday && (
                  <span className="mt-0.5 hidden text-[9px] font-bold uppercase tracking-tighter opacity-80 min-[390px]:inline">TODAY</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots Section */}
      <div className="mt-8 flex w-full flex-col gap-5 sm:mt-10 sm:gap-8 lg:mt-[65px]">
        <div>
          <h3 className="font-poppins text-xl font-semibold text-[#111111] sm:text-[22px]">
            Select Time Slot
          </h3>
          <p className="mt-2 text-sm text-[#5F5E5A]" aria-live="polite">
            {selectedSlot
              ? `Selected: ${formatBookingTime(selectedSlot.startAt, timezone)}`
              : "Select a time slot to continue."}
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-neutral-500">Loading availability…</p>
        ) : isError ? (
          <p className="text-sm text-neutral-500">Availability must load before you can choose a time.</p>
        ) : availability && !hasBookableDates ? (
          <p className="text-sm text-neutral-500">Choose another month to see available times.</p>
        ) : !selectedDateIso ? (
          <p className="text-sm text-neutral-500">Pick a date above to see available times.</p>
        ) :
          (selectedDay?.slots.length ?? 0) === 0 &&
          (selectedDay?.blockedSlots?.length ?? 0) > 0 ? (
          <p className="text-sm text-neutral-500">This date is fully booked. Try another day.</p>
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
