"use client";
import Image from "next/image";
import NotificationBell from "@/components/notifications/NotificationBell";
import WaiveChargeModal from "./WaiveChargeModal";
import { NoShowModal, CompleteModal, CancelBookingModal } from "./CalendarActionModals";

import React, { useEffect, useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar03Icon,
  ArrowDown01Icon,
  Add01Icon,
  Tick01Icon,
  Money01Icon,
  ViewIcon,
  Delete02Icon
} from "@hugeicons/core-free-icons";

import { useStaffListQuery } from "@/lib/staff/hooks";
import {
  useBusinessCalendarQuery,
  useCancelByBusinessMutation,
  useCompleteBookingMutation,
  useMarkNoShowMutation,
  useWaiveFeeMutation,
} from "@/lib/bookings/hooks";
import type { BookingCalendarEntry } from "@/lib/api/bookings";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, formatBookingMoney, formatBookingTime } from "@/lib/bookings/format";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";

interface DashboardCalendarProps {
  /** Undefined means this actor has no manageable business right now (e.g. STAFF — no product
   * rule grants Staff booking-management rights) — the grid renders with no bookings rather
   * than attempting a call the backend would reject. */
  businessId: string | undefined;
  onNewBookingClick?: () => void;
  onViewBookingClick?: (bookingId: string) => void;
  isStaffDashboard?: boolean;
  staffName?: string;
}

const GRID_START_HOUR = 8;
const GRID_END_HOUR = 18; // exclusive
const PX_PER_MINUTE = 160 / 60;

const TONE_CARD_CLASSNAMES: Record<string, { bg: string; border: string }> = {
  info: { bg: "bg-[#BBEBFF]", border: "border-[#0CC0DF]" },
  success: { bg: "bg-[#86EFAC]/65", border: "border-[#10B981]" },
  warning: { bg: "bg-[#FFB5D3]", border: "border-[#FF6B9E]" },
  danger: { bg: "bg-[#FFB5D3]", border: "border-[#FF6B9E]" },
  neutral: { bg: "bg-neutral-100", border: "border-neutral-400" },
};

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isoDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** The booking's own date, in ITS OWN snapshotted timezone — never the browser's local
 * timezone (matches lib/bookings/format.ts's own convention). */
const bookingLocalDateKey = (booking: BookingCalendarEntry): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: booking.schedule.timezone,
  }).formatToParts(new Date(booking.schedule.startAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const bookingLocalMinutes = (isoInstant: string, timezone: string): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone,
  }).formatToParts(new Date(isoInstant));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
};

export default function DashboardCalendar({
  businessId,
  onNewBookingClick,
  onViewBookingClick,
  isStaffDashboard = false,
  staffName = "Basel"
}: DashboardCalendarProps) {
  const [openDropdownCardId, setOpenDropdownCardId] = useState<string | null>(null);
  // A coarse ticking clock so the no-show eligibility hint (below) stays fresh without calling
  // an impure time function during render.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [viewMode, setViewMode] = useState("Weekly");
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);

  const [selectedStaffFilter, setSelectedStaffFilter] = useState(isStaffDashboard ? staffName : "All Staff");
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);

  // Modal State for Viewing Booking
  const [waiveBookingId, setWaiveBookingId] = useState<string | null>(null);
  const [noShowBookingId, setNoShowBookingId] = useState<string | null>(null);
  const [completeBookingId, setCompleteBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  // Drag to scroll states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerSelectedMonth, setDatePickerSelectedMonth] = useState(currentDate.getMonth());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [disabledSlots, setDisabledSlots] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  // --- Real data (Batch 6) --------------------------------------------------------------------
  const rangeStart = viewMode === "Weekly" ? startOfWeek(currentDate)
    : viewMode === "Monthly" ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const rangeEnd = viewMode === "Weekly" ? (() => { const d = new Date(rangeStart); d.setDate(d.getDate() + 6); return d; })()
    : viewMode === "Monthly" ? new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    : rangeStart;

  const calendarQuery = useBusinessCalendarQuery(businessId, isoDateOnly(rangeStart), isoDateOnly(rangeEnd));
  const staffListQuery = useStaffListQuery(businessId);
  const bookings = calendarQuery.data?.bookings ?? [];

  const completeBookingMutation = useCompleteBookingMutation();
  const cancelByBusinessMutation = useCancelByBusinessMutation();
  const markNoShowMutation = useMarkNoShowMutation();
  const waiveFeeMutation = useWaiveFeeMutation();

  const findBooking = (id: string) => bookings.find((b) => b.id === id);

  const formatDate = (date: Date) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (viewMode === "Today") {
      return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
    } else if (viewMode === "Weekly") {
      const endOfWeek = new Date(rangeStart);
      endOfWeek.setDate(rangeStart.getDate() + 6);
      return `${rangeStart.getDate()} ${months[rangeStart.getMonth()]} - ${endOfWeek.getDate()} ${months[endOfWeek.getMonth()]}`;
    } else {
      const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return `${fullMonths[date.getMonth()]} ${date.getFullYear()}`;
    }
  };

  const handlePrevDate = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "Today") {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === "Weekly") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNextDate = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "Today") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === "Weekly") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Dropdown Actions Implementation
  const handleMarkNoShow = (cardId: string) => {
    setNoShowBookingId(cardId);
    setOpenDropdownCardId(null);
  };

  const handleWaiveCharge = (cardId: string) => {
    setWaiveBookingId(cardId);
    setOpenDropdownCardId(null);
  };

  const handleViewBooking = (cardId: string) => {
    onViewBookingClick?.(cardId);
    setOpenDropdownCardId(null);
  };

  const handleCompleteBooking = (cardId: string) => {
    setCompleteBookingId(cardId);
    setOpenDropdownCardId(null);
  };

  const handleCancelBooking = (cardId: string) => {
    setCancelBookingId(cardId);
    setOpenDropdownCardId(null);
  };

  /**
   * The category no-show eligibility window (Batch 21). The backend is authoritative and
   * re-checks on submit; this is a truthful client-side hint only. Legacy bookings (no
   * snapshot) are always "open".
   */
  const noShowWindowState = (
    booking: ReturnType<typeof findBooking>,
  ): { state: "open" | "before" | "after"; opensAt?: Date; closesAt?: Date } => {
    const snap = booking?.noShowEligibilitySnapshot;
    if (!snap) return { state: "open" };
    const opensAt = new Date(snap.opensAt);
    const closesAt = new Date(snap.closesAt);
    if (nowMs < opensAt.getTime()) return { state: "before", opensAt, closesAt };
    if (nowMs >= closesAt.getTime()) return { state: "after", opensAt, closesAt };
    return { state: "open", opensAt, closesAt };
  };

  const renderDropdown = (cardId: string) => {
    if (openDropdownCardId !== cardId) return null;
    const booking = findBooking(cardId);
    const isUpcoming = booking?.status === "UPCOMING";
    const noShow = noShowWindowState(booking);
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-6 top-[25px] z-50 w-[160px] bg-white rounded-xl shadow-2xl border border-[#C6C6CB] flex flex-col py-1 text-xs select-none animate-fadeIn"
      >
        {isUpcoming && (
          <button
            disabled={noShow.state !== "open"}
            title={
              noShow.state === "before"
                ? `No-show opens ${noShow.opensAt?.toLocaleString()}`
                : noShow.state === "after"
                  ? `No-show window closed ${noShow.closesAt?.toLocaleString()}`
                  : undefined
            }
            className={`px-4 py-2 text-left flex items-center gap-2 font-medium ${
              noShow.state === "open"
                ? "hover:bg-neutral-50 text-[#BA1A1A] cursor-pointer"
                : "text-neutral-400 cursor-not-allowed"
            }`}
            onClick={() => noShow.state === "open" && handleMarkNoShow(cardId)}
          >
            <Image src="/calederions/userCross.svg" alt="No-show" className="w-3.5 h-3.5 shrink-0" width={12} height={12} />
            <span>
              {noShow.state === "before"
                ? "No-show (not open yet)"
                : noShow.state === "after"
                  ? "No-show (window closed)"
                  : "No-show"}
            </span>
          </button>
        )}
        {booking?.status === "PENDING" && (
          <button className="px-4 py-2 hover:bg-neutral-50 text-left flex items-center gap-2 text-[#1C1B1C] font-medium cursor-pointer" onClick={() => handleWaiveCharge(cardId)}>
            <HugeiconsIcon icon={Money01Icon} className="w-3.5 h-3.5 text-[#141B34] shrink-0" />
            <span>Waive charge</span>
          </button>
        )}
        <button className="px-4 py-2 hover:bg-neutral-50 text-left flex items-center gap-2 text-[#1C1B1C] font-medium cursor-pointer" onClick={() => handleViewBooking(cardId)}>
          <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5 text-[#0C0C0C] shrink-0" />
          <span>View Booking</span>
        </button>
        {isUpcoming && (
          <>
            <button className="px-4 py-2 hover:bg-neutral-50 text-left flex items-center gap-2 text-[#1C1B1C] font-medium cursor-pointer" onClick={() => handleCompleteBooking(cardId)}>
              <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 text-[#141B34] shrink-0" />
              <span>Complete</span>
            </button>
            <button className="px-4 py-2 hover:bg-neutral-50 text-left flex items-center gap-2 text-[#BA1A1A] font-medium cursor-pointer border-t border-neutral-100" onClick={() => handleCancelBooking(cardId)}>
              <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5 text-[#BA1A1A] shrink-0" />
              <span>Cancel Booking</span>
            </button>
          </>
        )}
      </div>
    );
  };

  const staffColumns = isStaffDashboard
    ? [{ name: staffName, hasBorder: true, membershipId: undefined as string | undefined }]
    : (staffListQuery.data?.members ?? [])
        .filter((m) => m.membershipId)
        .map((m, i) => ({ name: m.name, hasBorder: i === 0, membershipId: m.membershipId as string }));

  const bookingsForStaff = (staffMembershipId: string | undefined) =>
    bookings.filter((b) => !staffMembershipId || b.staffMembershipIds.includes(staffMembershipId));

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      {/* Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 py-3 sm:py-0 sm:h-16 border-b border-[#C6C6CB] bg-[#FCF8F8] px-6 items-center justify-between shrink-0 select-none">
        {/* Left side: Today & Date picker */}
        <div className="flex items-center gap-4 relative">
          {/* Today View Toggle Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setIsViewDropdownOpen(!isViewDropdownOpen);
                setIsStaffDropdownOpen(false);
              }}
              className="border border-[#111111] rounded-md px-3 py-1.5 flex items-center gap-1.5 h-9 bg-white hover:bg-neutral-50 transition-all text-sm font-medium text-[#111111] cursor-pointer"
            >
              <span>{viewMode}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5" />
            </button>
            {isViewDropdownOpen && (
              <div className="absolute left-0 mt-1.5 z-50 w-32 bg-white rounded-lg shadow-xl border border-neutral-200 flex flex-col py-1 text-xs select-none">
                {["Today", "Weekly", "Monthly"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setViewMode(mode);
                      setIsViewDropdownOpen(false);
                    }}
                    className="px-4 py-2 hover:bg-neutral-50 text-left text-[#111111] font-medium"
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Navigator */}
          <div className="flex items-center border border-[#C6C6CB] rounded-lg bg-white h-9 overflow-hidden relative">
            <button
              onClick={handlePrevDate}
              className="px-3 h-full border-r border-[#C6C6CB] hover:bg-neutral-50 transition-all text-neutral-600 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-2 px-4 h-full cursor-pointer hover:bg-neutral-50 transition-all select-none"
            >
              <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[#0C0C0C]" />
              <span className="font-poppins text-xs font-semibold text-[#1C1B1C] whitespace-nowrap">{formatDate(currentDate)}</span>
            </div>
            <button
              onClick={handleNextDate}
              className="px-3 h-full border-l border-[#C6C6CB] hover:bg-neutral-50 transition-all text-neutral-600 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right side: Staff, New Booking, Notifications */}
        <div className="flex items-center gap-4">
          {/* Staff filter dropdown */}
          {!isStaffDashboard && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsStaffDropdownOpen(!isStaffDropdownOpen);
                  setIsViewDropdownOpen(false);
                }}
                className="border border-[#111111] rounded-md px-3 py-1.5 flex items-center gap-1.5 h-9 bg-white hover:bg-neutral-50 transition-all text-sm font-medium text-[#111111] cursor-pointer"
              >
                <span>{selectedStaffFilter}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5" />
              </button>
              {isStaffDropdownOpen && (
                <div className="absolute right-0 mt-1.5 z-50 w-40 bg-white rounded-lg shadow-xl border border-neutral-200 flex flex-col py-1 text-xs select-none">
                  {["All Staff", ...staffColumns.map((s) => s.name)].map((staff) => (
                    <button
                      key={staff}
                      onClick={() => {
                        setSelectedStaffFilter(staff);
                        setIsStaffDropdownOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-neutral-50 text-left text-[#111111] font-medium cursor-pointer"
                    >
                      {staff}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Booking */}
          {!isStaffDashboard && (
            <button
              onClick={onNewBookingClick}
              className="bg-[#020305] text-white rounded-lg h-9 px-4 flex items-center gap-2 text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              <HugeiconsIcon icon={Add01Icon} className="w-4 h-4" />
              <span>New Booking</span>
            </button>
          )}

          {/* Bell Notification Button */}
          <NotificationBell />
        </div>
      </div>

      {!businessId ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">Booking management isn&apos;t available for your account</span>
          <span className="font-poppins text-xs text-[#ABAAA6] max-w-sm">Only the Business Owner and an active Supervisor can view and manage bookings.</span>
        </div>
      ) : (
      <>
      {/* Horizontal Scroll Wrapper for Headers & Grid on Mobile */}
      <div
        ref={scrollContainerRef}
        onMouseDown={(e) => {
          if (!scrollContainerRef.current) return;
          setIsDragActive(true);
          setDragStartX(e.pageX - scrollContainerRef.current.offsetLeft);
          setDragScrollLeft(scrollContainerRef.current.scrollLeft);
        }}
        onMouseLeave={() => setIsDragActive(false)}
        onMouseUp={() => setIsDragActive(false)}
        onMouseMove={(e) => {
          if (!isDragActive || !scrollContainerRef.current) return;
          e.preventDefault();
          const x = e.pageX - scrollContainerRef.current.offsetLeft;
          const walk = (x - dragStartX) * 1.5; // drag scroll speed multiplier
          scrollContainerRef.current.scrollLeft = dragScrollLeft - walk;
        }}
        className={`flex-1 flex flex-col ${viewMode === "Monthly" ? "overflow-hidden" : "overflow-x-auto overflow-y-hidden"} w-full touch-pan-x select-none ${isDragActive ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className={`${viewMode === "Monthly" ? "w-full min-w-0" : "min-w-[1000px]"} flex-1 flex flex-col min-h-0`}>
          {/* Calendar Headers (Resource Columns - Sticky) */}
          <div className="bg-[#FCF8F8] border-b border-[#C6C6CB] flex items-center shrink-0 select-none">
            {/* Left corner placeholder (Time / Staff header) */}
            <div
              className="h-14 sm:h-16 border-r border-[#C6C6CB] shrink-0 flex items-center justify-center font-poppins text-xs font-semibold text-[#45474B]"
              style={{ width: viewMode === "Weekly" ? "80px" : "64px" }}
            >
              {viewMode === "Weekly" ? "Staff" : ""}
            </div>

            {/* Header Columns */}
            {viewMode === "Weekly" ? (
              // Weekly View: 7 Days of the week (Mon - Sun), real dates from rangeStart
              <div className="flex-1 grid grid-cols-7 divide-x divide-[#C6C6CB]">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(rangeStart);
                  d.setDate(rangeStart.getDate() + i);
                  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
                  const shortDayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  const isToday = isoDateOnly(d) === isoDateOnly(today);
                  return (
                    <div key={i} className="flex items-center justify-center py-3 gap-2 px-1">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isToday ? "bg-[#020305] text-white" : "text-[#1C1B1C]"}`}>
                        {d.getDate()}
                      </span>
                      <span className={`font-poppins text-xs font-medium ${isToday ? "text-[#020305] font-bold" : "text-[#45474B]"} truncate`}>
                        <span className="hidden sm:inline">{dayNames[i]}</span>
                        <span className="inline sm:hidden">{shortDayNames[i]}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Today / Daily View: Staff Columns
              (() => {
                const activeStaffList = staffColumns.filter(staff => selectedStaffFilter === "All Staff" || staff.name === selectedStaffFilter);
                return (
                  <div className="flex-1 grid divide-x divide-[#C6C6CB]" style={{ gridTemplateColumns: `repeat(${Math.max(activeStaffList.length, 1)}, minmax(0, 1fr))` }}>
                    {activeStaffList.map((staff, index) => (
                      <div key={index} className="flex flex-col items-center justify-center py-3.5 gap-1.5">
                        <div className={`p-[1px] rounded-full ${staff.hasBorder ? "border-2 border-[#0CC0DF]" : "border border-neutral-200"}`}>
                          <Image src="/calederions/calendrImage.jpg" alt={staff.name} className="w-10 h-10 rounded-full object-cover" width={40} height={40} />
                        </div>
                        <div className="flex items-center gap-1 cursor-pointer">
                          <span className="font-poppins text-xs font-semibold text-[#020305]">{staff.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Scrollable Grid Area */}
          <div className="flex-1 overflow-y-auto relative bg-[#FCF8F8] select-none min-h-0">
            {calendarQuery.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-poppins text-sm text-neutral-400">Loading calendar…</span>
              </div>
            ) : viewMode === "Monthly" ? (
              /* MONTHLY VIEW: Calendar Dates Grid, real per-day booking summaries */
              <div className="p-4 bg-[#FCF8F8] min-h-[500px]">
                <div className="grid grid-cols-7 gap-2 bg-[#C6C6CB]/20 p-2 rounded-xl border border-[#C6C6CB]/40">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((dayName) => (
                    <div key={dayName} className="py-2 text-center text-xs font-semibold font-poppins text-[#45474B] uppercase tracking-wider">
                      <span className="hidden sm:inline">{dayName}</span>
                      <span className="inline sm:hidden">{dayName.substring(0, 3)}</span>
                    </div>
                  ))}

                  {(() => {
                    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    const firstOffset = (() => { const day = monthStart.getDay(); return day === 0 ? 6 : day - 1; })();
                    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                    const cells: { date: Date; inMonth: boolean }[] = [];
                    for (let i = firstOffset; i > 0; i--) {
                      const d = new Date(monthStart); d.setDate(1 - i);
                      cells.push({ date: d, inMonth: false });
                    }
                    for (let d = 1; d <= daysInMonth; d++) {
                      cells.push({ date: new Date(currentDate.getFullYear(), currentDate.getMonth(), d), inMonth: true });
                    }
                    while (cells.length % 7 !== 0) {
                      const last = cells[cells.length - 1]?.date ?? monthStart;
                      const d = new Date(last); d.setDate(last.getDate() + 1);
                      cells.push({ date: d, inMonth: false });
                    }

                    return cells.map((cell, idx) => {
                      const dateKey = isoDateOnly(cell.date);
                      const dayBookings = bookings.filter((b) => bookingLocalDateKey(b) === dateKey);
                      const isToday = dateKey === isoDateOnly(today);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (cell.inMonth) {
                              setCurrentDate(cell.date);
                              setViewMode("Today");
                            }
                          }}
                          className={`min-h-[100px] p-2 border border-[#C6C6CB]/30 rounded-lg flex flex-col justify-between transition-all duration-150 cursor-pointer hover:border-[#020305] hover:shadow-sm ${!cell.inMonth ? "opacity-35 bg-neutral-50/50" : "bg-white"
                            } ${isToday ? "ring-2 ring-[#020305]/20 border-[#020305]" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold font-poppins ${isToday ? "bg-[#020305] text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-[#1C1B1C]"}`}>
                              {cell.date.getDate()}
                            </span>
                          </div>

                          {cell.inMonth && dayBookings.length > 0 && (
                            <div className="mt-1.5 flex flex-col gap-1">
                              {dayBookings.slice(0, 2).map((b) => (
                                <div key={b.id} className="bg-[#BBEBFF] text-[#195156] text-[10px] font-semibold px-1.5 py-0.5 rounded truncate">
                                  {formatBookingTime(b.schedule.startAt, b.schedule.timezone)} {b.customerName}
                                </div>
                              ))}
                              {dayBookings.length > 2 && (
                                <div className="text-[9px] font-semibold text-[#45474B] px-1.5">+{dayBookings.length - 2} more</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : viewMode === "Weekly" ? (
              /* WEEKLY VIEW: Staff rows on Left, 7 real Day columns */
              <div className="flex flex-col w-full relative">
                {/* Backdrop overlay */}
                {openDropdownCardId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent cursor-default"
                    onClick={() => setOpenDropdownCardId(null)}
                  />
                )}
                {staffColumns
                  .filter(staff => selectedStaffFilter === "All Staff" || staff.name === selectedStaffFilter)
                  .map((staff) => {
                    const staffBookings = bookingsForStaff(staff.membershipId);
                    return (
                      <div key={staff.name} className="flex border-b border-[#C6C6CB] min-h-[140px] relative">
                        {/* Left Staff Row Header */}
                        <div
                          className="border-r border-[#C6C6CB] bg-[#FCF8F8] p-3 flex flex-col items-center justify-center gap-1 shrink-0 z-10"
                          style={{ width: "80px" }}
                        >
                          <Image src="/calederions/calendrImage.jpg" alt={staff.name} className="w-9 h-9 rounded-full object-cover border border-neutral-200" width={36} height={36} />
                          <span className="font-poppins text-xs font-semibold text-[#020305] text-center leading-tight">
                            {staff.name}
                          </span>
                        </div>

                        {/* 7 real Day Columns */}
                        <div className="flex-1 grid grid-cols-7 divide-x divide-[#C6C6CB] relative">
                          {Array.from({ length: 7 }, (_, dayIdx) => {
                            const d = new Date(rangeStart);
                            d.setDate(rangeStart.getDate() + dayIdx);
                            const dateKey = isoDateOnly(d);
                            const slotKey = `${staff.name}-${dateKey}`;
                            const isSelected = selectedSlots.includes(slotKey);
                            const isDisabled = disabledSlots.includes(slotKey);
                            const dayBookings = staffBookings.filter((b) => bookingLocalDateKey(b) === dateKey);
                            const hasBooking = dayBookings.length > 0;

                            return (
                              <div
                                key={dayIdx}
                                onClick={() => {
                                  if (hasBooking) return;

                                  const isDeselect = selectedSlots.includes(slotKey);
                                  if (isDeselect) {
                                    setSelectedSlots(prev => prev.filter(k => k !== slotKey));
                                    return;
                                  }

                                  if (selectedSlots.length > 0) {
                                    const firstKey = selectedSlots[0];
                                    const firstIsDisabled = disabledSlots.includes(firstKey);
                                    if (isDisabled !== firstIsDisabled) {
                                      return;
                                    }
                                  }

                                  setSelectedSlots(prev => [...prev, slotKey]);
                                }}
                                className={`p-2 relative min-h-[140px] flex flex-col gap-1.5 transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-[#2E9DA7]/15 border-2 border-[#2E9DA7]"
                                    : isDisabled
                                      ? "bg-[#F1F5F9] border-2 border-dashed border-[#CBD5E1] text-[#94A3B8]"
                                      : "hover:bg-neutral-50"
                                }`}
                              >
                                {isDisabled && !isSelected && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                                    <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">Disabled</span>
                                  </div>
                                )}
                                {dayBookings.map((b) => {
                                  const tone = BOOKING_STATUS_TONE[b.status];
                                  return (
                                    <div
                                      key={b.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownCardId(openDropdownCardId === b.id ? null : b.id);
                                      }}
                                      className={`bg-[#0CC0DF]/20 border-l-4 border-[#0CC0DF] rounded px-2 py-1.5 text-xs cursor-pointer hover:brightness-95 transition-all relative ${openDropdownCardId === b.id ? "z-40" : "z-20"}`}
                                    >
                                      <div className="font-semibold text-[#020305] text-[11px] truncate flex items-center justify-between">
                                        <span>{formatBookingTime(b.schedule.startAt, b.schedule.timezone)} {b.customerName}</span>
                                      </div>
                                      <div className="text-[10px] text-[#45474B] truncate">{b.serviceNames[0] ?? ""}</div>
                                      <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: undefined }}>
                                        <span className={`px-1 py-0.5 rounded ${tone === "danger" ? "text-[#BA1A1A]" : tone === "success" ? "text-[#2F8068]" : "text-[#45474B]"}`}>
                                          {BOOKING_STATUS_LABELS[b.status]}
                                        </span>
                                      </div>
                                      {renderDropdown(b.id)}
                                    </div>
                                  );
                                })}

                                {isSelected && !hasBooking && (
                                  <div className="absolute top-2 right-2 w-4 h-4 bg-[#2E9DA7] text-white flex items-center justify-center rounded text-[10px] font-bold">
                                    ✓
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* DAILY / TODAY VIEW — real top/height from real schedule.startAt/endAt, clipped
                 to the visible 8:00-18:00 grid (unchanged grid bounds — see the Batch 6 report's
                 note on this simplification). */
              <div className="flex w-full h-[1600px] relative">
                {openDropdownCardId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent cursor-default"
                    onClick={() => setOpenDropdownCardId(null)}
                  />
                )}
                {/* Background Horizontal Grid Lines */}
                <div className="absolute left-[65px] right-0 top-0 bottom-0 pointer-events-none flex flex-col z-0">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className="h-40 w-full flex flex-col">
                      <div className="h-20 border-b border-dashed border-[#C6C6CB]/20"></div>
                      <div className="h-20 border-b border-[#C6C6CB]/40"></div>
                    </div>
                  ))}
                </div>

                {/* Time Column (Left Side Axis) */}
                <div className="border-r border-[#C6C6CB] bg-[#FCF8F8] flex flex-col shrink-0 relative z-10" style={{ width: "64px" }}>
                  {["8:00", "9:00", "10:00", "11:00", "12:00", "1:00", "2:00", "3:00", "4:00", "5:00"].map((time, idx) => (
                    <div key={idx} className="h-40 flex justify-center items-start pt-2">
                      <span className="font-poppins text-[11px] font-semibold text-[#45474B]">{time}</span>
                    </div>
                  ))}
                </div>

                {(() => {
                  const activeStaffList = staffColumns.filter(staff => selectedStaffFilter === "All Staff" || staff.name === selectedStaffFilter);
                  const dateKey = isoDateOnly(currentDate);
                  return (
                    <div className="flex-1 grid divide-x divide-[#C6C6CB] relative w-full" style={{ gridTemplateColumns: `repeat(${Math.max(activeStaffList.length, 1)}, minmax(0, 1fr))` }}>
                      {activeStaffList.map((staff) => {
                        const dayBookings = bookingsForStaff(staff.membershipId).filter((b) => bookingLocalDateKey(b) === dateKey);
                        return (
                        <div key={staff.name} className="relative h-full">
                          {/* Render click-capturable empty slots behind the bookings */}
                          <div className="absolute inset-0 z-0 flex flex-col">
                            {Array.from({ length: 10 }).map((_, hourIdx) => (
                              <div key={hourIdx} className="h-40 flex flex-col border-b border-[#C6C6CB]/20">
                                {[0, 1].map((halfIdx) => {
                                  const slotKey = `${staff.name}-today-${hourIdx}-${halfIdx}`;
                                  const isSelected = selectedSlots.includes(slotKey);
                                  const isDisabled = disabledSlots.includes(slotKey);
                                  return (
                                    <div
                                      key={halfIdx}
                                      onClick={() => {
                                        const isDeselect = selectedSlots.includes(slotKey);
                                        if (isDeselect) {
                                          setSelectedSlots(prev => prev.filter(k => k !== slotKey));
                                          return;
                                        }

                                        if (selectedSlots.length > 0) {
                                          const firstKey = selectedSlots[0];
                                          const firstIsDisabled = disabledSlots.includes(firstKey);
                                          if (isDisabled !== firstIsDisabled) {
                                            return;
                                          }
                                        }

                                        setSelectedSlots(prev => [...prev, slotKey]);
                                      }}
                                      className={`h-20 w-full relative transition-all cursor-pointer flex items-center justify-center ${
                                        isSelected
                                          ? "bg-[#2E9DA7]/15 border border-[#2E9DA7]"
                                          : isDisabled
                                            ? "bg-[#F1F5F9] border-b border-dashed border-[#CBD5E1] text-[#94A3B8]"
                                            : "hover:bg-neutral-50/50"
                                      }`}
                                    >
                                      {isDisabled && !isSelected && (
                                        <span className="text-[9px] font-bold tracking-wider text-[#94A3B8] uppercase pointer-events-none">Disabled</span>
                                      )}
                                      {isSelected && (
                                        <div className="absolute top-2 right-2 w-4 h-4 bg-[#2E9DA7] text-white flex items-center justify-center rounded text-[10px] font-bold">
                                          ✓
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>

                          {dayBookings.map(b => {
                            const startMin = bookingLocalMinutes(b.schedule.startAt, b.schedule.timezone);
                            const endMin = bookingLocalMinutes(b.schedule.endAt, b.schedule.timezone);
                            const gridStartMin = GRID_START_HOUR * 60;
                            const gridEndMin = GRID_END_HOUR * 60;
                            if (endMin <= gridStartMin || startMin >= gridEndMin) return null; // outside the visible grid
                            const clippedStart = Math.max(startMin, gridStartMin);
                            const clippedEnd = Math.min(endMin, gridEndMin);
                            const top = (clippedStart - gridStartMin) * PX_PER_MINUTE;
                            const height = Math.max(24, (clippedEnd - clippedStart) * PX_PER_MINUTE);
                            const tone = BOOKING_STATUS_TONE[b.status];
                            const cardColors = TONE_CARD_CLASSNAMES[tone];

                            return (
                              <div
                                key={b.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownCardId(openDropdownCardId === b.id ? null : b.id);
                                }}
                                className={`absolute left-[3%] right-[3%] ${cardColors.bg} border-l-4 ${cardColors.border} rounded-md p-2 shadow-sm flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-transform ${openDropdownCardId === b.id ? "z-40" : "z-20"}`}
                                style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                <button className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-900 select-none cursor-pointer">
                                  <svg className="w-1 h-3" fill="currentColor" viewBox="0 0 4 16">
                                    <path d="M2 10a2 2 0 110-4 2 2 0 010 4zm0-6a2 2 0 110-4 2 2 0 010 4zm0 12a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                <div>
                                  <div className="flex justify-between items-center pr-4">
                                    <span className="text-[9px] font-medium text-[#45474B] leading-none">
                                      {formatBookingTime(b.schedule.startAt, b.schedule.timezone)}
                                    </span>
                                    <span className="bg-white/50 px-1 py-0.5 rounded text-[8px] font-semibold text-[#45474B] leading-none flex items-center gap-0.5">
                                      <span>{BOOKING_STATUS_LABELS[b.status]}</span>
                                      {b.status === "COMPLETED" && (
                                        <HugeiconsIcon icon={Tick01Icon} className="w-2 h-2 text-[#10B981]" />
                                      )}
                                    </span>
                                  </div>
                                  <h4 className="font-poppins text-xs font-semibold text-[#020305] mt-1.5 truncate">{b.customerName}</h4>
                                  <p className="text-[10px] text-[#45474B] truncate mt-0.5">{b.serviceNames.join(", ")}</p>
                                </div>
                                <span className="text-[10px] font-medium text-[#45474B]">{formatBookingMoney(b.totalCents)}</span>
                                {renderDropdown(b.id)}
                              </div>
                            );
                          })}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slots selected bottom bar */}
      {selectedSlots.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white border border-[#C6C6CB] rounded-xl px-4 py-3 shadow-xl flex flex-col sm:flex-row items-center justify-between w-[calc(100%-32px)] sm:w-[640px] min-h-[94px] h-auto gap-4 sm:gap-0 z-30 select-none animate-fadeIn">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-[31px] h-10 rounded-full bg-[#CFE1FE] flex items-center justify-center shrink-0">
              <Image src="/calederions/edit.svg" alt="Edit Icon" className="w-5 h-5 object-contain" width={20} height={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-poppins text-sm font-semibold text-[#020305]">{selectedSlots.length} {selectedSlots.length === 1 ? "slot" : "slots"} selected</span>
              <span className="text-xs text-[#45474B] font-poppins">
                {Array.from(new Set(selectedSlots.map(k => k.split("-")[0]))).join(", ")}&apos;s schedule
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            {(() => {
              const hasDisabledSelected = selectedSlots.some(key => disabledSlots.includes(key));

              if (hasDisabledSelected) {
                return (
                  <button
                    onClick={() => {
                      setDisabledSlots(prev => prev.filter(k => !selectedSlots.includes(k)));
                      setSelectedSlots([]);
                    }}
                    className="bg-[#2E9DA7] text-white text-xs sm:text-sm font-medium px-4 sm:px-[36.2px] h-[44px] sm:h-[50px] rounded-lg hover:bg-[#20848f] transition-colors shadow-md flex-1 sm:flex-initial cursor-pointer"
                  >
                    Activate Selected Slots ({selectedSlots.length})
                  </button>
                );
              }

              return (
                <button
                  onClick={() => {
                    setDisabledSlots(prev => [...prev, ...selectedSlots]);
                    setSelectedSlots([]);
                  }}
                  className="bg-[#020305] text-white text-xs sm:text-sm font-medium px-4 sm:px-[36.2px] h-[44px] sm:h-[50px] rounded-lg hover:bg-neutral-800 transition-colors shadow-md flex-1 sm:flex-initial cursor-pointer"
                >
                  Disable Selected Slots ({selectedSlots.length})
                </button>
              );
            })()}
            <button
              onClick={() => setSelectedSlots([])}
              className="text-[#45474B] hover:text-neutral-900 text-xs sm:text-sm font-medium transition-colors shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* Waive Charge Modal Overlay */}
      <WaiveChargeModal
        isOpen={!!waiveBookingId}
        onClose={() => setWaiveBookingId(null)}
        onConfirm={(reason, internalNote) => {
          if (businessId && waiveBookingId) {
            waiveFeeMutation.mutate({ businessId, bookingId: waiveBookingId, reason, internalNote });
          }
          setWaiveBookingId(null);
        }}
      />

      {/* No-show Confirm Modal Overlay */}
      <NoShowModal
        isOpen={!!noShowBookingId}
        onClose={() => setNoShowBookingId(null)}
        onConfirm={(payload) => {
          if (businessId && noShowBookingId) {
            markNoShowMutation.mutate(
              {
                businessId,
                bookingId: noShowBookingId,
                reason: payload?.reason,
                internalNote: payload?.internalNote,
              },
              {
                onSuccess: () => toast.success("No-show timer started."),
                onError: (error) => toast.error(toUserMessage(error)),
              },
            );
          }
          setNoShowBookingId(null);
        }}
      />

      {/* Complete Booking Confirm Modal Overlay */}
      <CompleteModal
        isOpen={!!completeBookingId}
        onClose={() => setCompleteBookingId(null)}
        onConfirm={(venuePayment) => {
          if (businessId && completeBookingId) {
            completeBookingMutation.mutate(
              { businessId, bookingId: completeBookingId, venuePayment },
              {
                onSuccess: () => toast.success("Booking completed."),
                onError: (error) => toast.error(toUserMessage(error)),
              },
            );
          }
          setCompleteBookingId(null);
        }}
      />

      {/* Cancel Booking Confirm Modal Overlay */}
      <CancelBookingModal
        isOpen={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        onConfirm={(reason) => {
          if (businessId && cancelBookingId) {
            cancelByBusinessMutation.mutate({ businessId, bookingId: cancelBookingId, reason });
          }
          setCancelBookingId(null);
        }}
      />

      {/* DatePicker Dropdown/Modal overlay */}
      {isDatePickerOpen && (
        <>
          {/* Backdrop close capture */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
            onClick={() => setIsDatePickerOpen(false)}
          />

          <div className="fixed inset-0 sm:absolute sm:inset-auto sm:top-[45px] sm:left-0 z-50 bg-white sm:rounded-2xl shadow-[0px_8px_30px_rgba(0,0,0,0.12)] border border-neutral-100 p-6 flex flex-col font-sans h-screen sm:h-auto overflow-y-auto w-full sm:w-[680px]">
            <div className="flex justify-between items-center pb-4 border-b border-neutral-100 sm:border-none">
              <div className="flex gap-2 overflow-x-auto pb-1 w-full no-scrollbar">
                {["In 1 week", "In 2 weeks", "In 3 weeks", "In 4 weeks", "In 5 weeks"].map((label, idx) => (
                  <button
                    key={label}
                    onClick={() => {
                      const futureDate = new Date();
                      futureDate.setDate(futureDate.getDate() + (idx + 1) * 7);
                      setCurrentDate(futureDate);
                      setIsDatePickerOpen(false);
                    }}
                    className="px-4 py-1.5 border border-neutral-200 hover:border-neutral-800 rounded-full text-xs font-semibold whitespace-nowrap text-[#1C1B1C] transition-colors cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setIsDatePickerOpen(false)}
                className="text-neutral-600 hover:text-neutral-900 font-medium text-lg px-2 sm:hidden cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Desktop View: Double Side-by-Side Month Calendars (with dynamic arrow paging) */}
            {(() => {
              const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

              const m1Index = datePickerSelectedMonth;
              const m2Index = (datePickerSelectedMonth + 1) % 12;
              const baseYear = currentDate.getFullYear();
              const m1Year = baseYear;
              const m2Year = m2Index === 0 ? baseYear + 1 : baseYear;

              const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
              const getFirstDayOffset = (month: number, year: number) => {
                const day = new Date(year, month, 1).getDay();
                return day === 0 ? 6 : day - 1;
              };

              const m1Days = getDaysInMonth(m1Index, m1Year);
              const m1Offset = getFirstDayOffset(m1Index, m1Year);

              const m2Days = getDaysInMonth(m2Index, m2Year);
              const m2Offset = getFirstDayOffset(m2Index, m2Year);

              return (
                <div className="hidden sm:flex gap-8 mt-4">
                  {/* Left Month Calendar */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() => setDatePickerSelectedMonth(prev => prev === 0 ? 11 : prev - 1)}
                        className="text-neutral-600 hover:text-neutral-900 font-bold p-1 px-2 hover:bg-neutral-100 rounded cursor-pointer"
                      >
                        &larr;
                      </button>
                      <span className="font-semibold text-sm text-[#1C1B1C]">{monthsList[m1Index]} {m1Year}</span>
                      <span className="w-8"></span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                        <span key={d} className="font-semibold text-[#45474B] py-1">{d}</span>
                      ))}
                      {Array.from({ length: m1Offset }).map((_, i) => (
                        <span key={`b1-${i}`} className="py-1.5"></span>
                      ))}
                      {Array.from({ length: m1Days }).map((_, d) => {
                        const dayNum = d + 1;
                        const isSelected = currentDate.getDate() === dayNum && currentDate.getMonth() === m1Index && currentDate.getFullYear() === m1Year;
                        return (
                          <button
                            key={`m1-d-${dayNum}`}
                            onClick={() => {
                              setCurrentDate(new Date(m1Year, m1Index, dayNum));
                              setViewMode("Today");
                              setIsDatePickerOpen(false);
                            }}
                            className={`py-1.5 rounded-full font-medium hover:bg-neutral-100 transition-colors cursor-pointer ${
                              isSelected ? "bg-[#020305] text-white" : "text-[#1C1B1C]"
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Month Calendar */}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-3">
                      <span className="w-8"></span>
                      <span className="font-semibold text-sm text-[#1C1B1C]"> {monthsList[m2Index]} {m2Year}</span>
                      <button
                        onClick={() => setDatePickerSelectedMonth(prev => (prev + 1) % 12)}
                        className="text-neutral-600 hover:text-neutral-900 font-bold p-1 px-2 hover:bg-neutral-100 rounded cursor-pointer"
                      >
                        &rarr;
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                        <span key={d} className="font-semibold text-[#45474B] py-1">{d}</span>
                      ))}
                      {Array.from({ length: m2Offset }).map((_, i) => (
                        <span key={`b2-${i}`} className="py-1.5"></span>
                      ))}
                      {Array.from({ length: m2Days }).map((_, d) => {
                        const dayNum = d + 1;
                        const isSelected = currentDate.getDate() === dayNum && currentDate.getMonth() === m2Index && currentDate.getFullYear() === m2Year;
                        return (
                          <button
                            key={`m2-d-${dayNum}`}
                            onClick={() => {
                              setCurrentDate(new Date(m2Year, m2Index, dayNum));
                              setViewMode("Today");
                              setIsDatePickerOpen(false);
                            }}
                            className={`py-1.5 rounded-full font-medium hover:bg-neutral-100 transition-colors cursor-pointer ${
                              isSelected ? "bg-[#020305] text-white" : "text-[#1C1B1C]"
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Mobile View: Vertical scroll calendar stack (scrolling next months automatically) */}
            {(() => {
              const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
              const generatedMonths = Array.from({ length: 12 }, (_, i) => {
                const now = new Date();
                now.setMonth(now.getMonth() + i);
                return {
                  monthIndex: now.getMonth(),
                  year: now.getFullYear()
                };
              });

              return (
                <div className="flex sm:hidden flex-col gap-6 mt-4 pb-20 overflow-y-auto flex-1">
                  {generatedMonths.map(({ monthIndex, year }) => {
                    const daysCount = new Date(year, monthIndex + 1, 0).getDate();
                    const firstDay = new Date(year, monthIndex, 1).getDay();
                    const offset = firstDay === 0 ? 6 : firstDay - 1;

                    return (
                      <div key={`${year}-${monthIndex}`} className="border-b border-neutral-100 pb-4">
                        <span className="font-bold text-sm text-[#1C1B1C] block mb-3">{monthsList[monthIndex]} {year}</span>
                        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                            <span key={d} className="font-semibold text-[#45474B] py-1">{d}</span>
                          ))}
                          {Array.from({ length: offset }).map((_, i) => (
                            <span key={`mob-b-${i}`} className="py-2"></span>
                          ))}
                          {Array.from({ length: daysCount }).map((_, d) => {
                            const dayNum = d + 1;
                            const isSelected = currentDate.getDate() === dayNum && currentDate.getMonth() === monthIndex && currentDate.getFullYear() === year;
                            return (
                              <button
                                key={`mob-d-${dayNum}`}
                                onClick={() => {
                                  setCurrentDate(new Date(year, monthIndex, dayNum));
                                  setViewMode("Today");
                                  setIsDatePickerOpen(false);
                                }}
                                className={`py-2 rounded-full font-medium hover:bg-neutral-100 transition-colors cursor-pointer ${
                                  isSelected ? "bg-[#020305] text-white" : "text-[#1C1B1C]"
                                }`}
                              >
                                {dayNum}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </main>
  );
}
