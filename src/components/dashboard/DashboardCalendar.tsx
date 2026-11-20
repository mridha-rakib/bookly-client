"use client";
import Image from "next/image";
import NotificationBell from "@/components/notifications/NotificationBell";
import WaiveChargeModal from "./WaiveChargeModal";
import { NoShowModal, CancelBookingModal } from "./CalendarActionModals";
import CalendarBookingCompletion from "./CalendarBookingCompletion";

import React, { useEffect, useState, useRef, useMemo } from "react";
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
  useMarkNoShowMutation,
  useWaiveFeeMutation,
} from "@/lib/bookings/hooks";
import { BUSINESS_BOOKING_STATUS_LABELS as BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, formatBookingDate, formatBookingMoney, formatBookingTime, formatCompactPackageSessionLabel, formatPackageSessionLabel } from "@/lib/bookings/format";
import { formatTime12Hour } from "@/lib/staff/format";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { bookingDayInterval, calendarDayHours, calendarDayLanes, calendarDayTimeline } from "@/lib/bookings/calendar-hours";
import { useCalendarBlocksQuery, useChangeCalendarBlocksMutation } from "@/lib/business/availability-hooks";
import { calendarInstantRangeState, calendarRange, createCalendarRangeState } from "@/lib/bookings/calendar-blocks";
import type { LocalCalendarRange } from "@/lib/api/business-availability";

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

const PX_PER_MINUTE = 160 / 60;

// Grid bounds and labels share the same Business-hours/Staff/Booking-derived range.

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

/** A civil date in the Business timezone, represented as a browser-local calendar date. */
const businessToday = (timezone: string | undefined): Date => {
  if (!timezone) return new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return new Date(Number(get("year")), Number(get("month")) - 1, Number(get("day")), 12);
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

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [navigated, setNavigated] = useState(false);
  const initializedBusiness = useRef<string | undefined>(undefined);

  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string | null>(null);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);

  // Modal State for Viewing Booking
  const [waiveBookingId, setWaiveBookingId] = useState<string | null>(null);
  const [noShowBookingId, setNoShowBookingId] = useState<string | null>(null);
  const [completeBookingId, setCompleteBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  // Drag to scroll states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [blockScope, setBlockScope] = useState<"STAFF" | "BUSINESS">("STAFF");
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

  // The endpoint filters by start instant. Pad civil dates in UTC to cover timezone offsets
  // and appointments which started on the preceding day, then render only intersecting days.
  const queryFromDate = new Date(Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() - 2)).toISOString();
  const queryToDate = new Date(Date.UTC(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate() + 3) - 1).toISOString();
  const calendarQuery = useBusinessCalendarQuery(businessId, queryFromDate, queryToDate);
  const staffListQuery = useStaffListQuery(businessId);
  const blocksQuery = useCalendarBlocksQuery(isStaffDashboard ? undefined : businessId);
  const changeBlocksMutation = useChangeCalendarBlocksMutation();
  const bookings = calendarQuery.data?.bookings ?? [];
  const calendarTimezone = blocksQuery.data?.timezone ?? calendarQuery.data?.timezone;
  const today = businessToday(calendarTimezone);
  useEffect(() => {
    if (!calendarTimezone || !businessId) return;
    if (initializedBusiness.current !== businessId) {
      const isNewBusiness = initializedBusiness.current !== undefined;
      initializedBusiness.current = businessId;
      if (isNewBusiness || !navigated) {
        // Synchronize the initial civil date once the Business timezone is available.
        setCurrentDate(businessToday(calendarTimezone));
      }
      if (isNewBusiness) { setSelectedStaffFilter(null); setSelectedSlots([]); }
    }
  }, [businessId, calendarTimezone, navigated]);
  const navigateDate = (date: Date) => { setNavigated(true); setCurrentDate(date); setSelectedSlots([]); setOpenDropdownCardId(null); };

  const cancelByBusinessMutation = useCancelByBusinessMutation();
  const markNoShowMutation = useMarkNoShowMutation();
  const waiveFeeMutation = useWaiveFeeMutation();
  const lifecycleActionInFlight = useRef(false);

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
      const day = newDate.getDate(); newDate.setDate(1); newDate.setMonth(newDate.getMonth() - 1);
      newDate.setDate(Math.min(day, new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()));
    }
    navigateDate(newDate);
  };

  const handleNextDate = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "Today") {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === "Weekly") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      const day = newDate.getDate(); newDate.setDate(1); newDate.setMonth(newDate.getMonth() + 1);
      newDate.setDate(Math.min(day, new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate()));
    }
    navigateDate(newDate);
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
    if (findBooking(cardId)?.firstClassPackage) {
      onViewBookingClick?.(cardId);
    } else {
      setCompleteBookingId(cardId);
    }
    setOpenDropdownCardId(null);
  };

  const handleCancelBooking = (cardId: string) => {
    setCancelBookingId(cardId);
    setOpenDropdownCardId(null);
  };

  /** Date and time of a no-show window in the calendar's Business timezone. */
  const formatNoShowTimestamp = (date: Date, bookingTimezone: string): string => {
    const timezone = calendarTimezone ?? bookingTimezone;
    return `${formatBookingDate(date.toISOString(), timezone)}, ${formatBookingTime(date.toISOString(), timezone)}`;
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

  const renderDropdown = (cardId: string, instanceKey: string) => {
    if (openDropdownCardId !== instanceKey) return null;
    const booking = findBooking(cardId);
    const isUpcoming = booking?.status === "UPCOMING";
    const noShow = noShowWindowState(booking);
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute right-6 top-[25px] z-50 w-[160px] bg-white rounded-xl shadow-2xl border border-[#C6C6CB] flex flex-col py-1 text-xs select-none animate-fadeIn"
      >
        {booking?.packageSessions.map((session, index) => (
          <p
            key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
            className="px-4 py-2 text-[10px] font-semibold text-[#3760B7]"
          >
            {formatPackageSessionLabel(session)}
          </p>
        ))}
        {isUpcoming && (
          <button
            disabled={noShow.state !== "open"}
            title={
              noShow.state === "before"
                ? `No-show opens ${noShow.opensAt && booking ? formatNoShowTimestamp(noShow.opensAt, booking.schedule.timezone) : ""}`
                : noShow.state === "after"
                  ? `No-show window closed ${noShow.closesAt && booking ? formatNoShowTimestamp(noShow.closesAt, booking.schedule.timezone) : ""}`
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
            <button disabled={Boolean(booking?.firstClassPackage && !onViewBookingClick)} className="px-4 py-2 hover:bg-neutral-50 text-left flex items-center gap-2 text-[#1C1B1C] font-medium cursor-pointer disabled:opacity-50" onClick={() => handleCompleteBooking(cardId)}>
              <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 text-[#141B34] shrink-0" />
              <span>{booking?.firstClassPackage ? "Manage package appointment" : "Complete"}</span>
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

  // A persisted appointment stays visible after its Staff member is removed from the
  // current directory. Use its canonical membership identity and snapshotted name.
  if (!isStaffDashboard) for (const booking of bookings) {
    booking.staffMembershipIds.forEach((membershipId, index) => {
      if (!staffColumns.some(column => column.membershipId === membershipId)) {
        staffColumns.push({ membershipId, name: booking.staffNames[index] ?? "Staff", hasBorder: staffColumns.length === 0 });
      }
    });
  }

  const bookingsForStaff = (staffMembershipId: string | undefined) =>
    bookings.filter((b) => !staffMembershipId || b.staffMembershipIds.includes(staffMembershipId));

  const savedRangeState = useMemo(() => createCalendarRangeState(blocksQuery.data?.blocks ?? [], blocksQuery.data?.closedPeriods ?? [], calendarTimezone ?? "Europe/Nicosia"), [blocksQuery.data, calendarTimezone]);
  const rangeState = (key: string) => savedRangeState(JSON.parse(key) as LocalCalendarRange);
  const canChangeBlocks = Boolean(businessId && !isStaffDashboard && blocksQuery.data && !blocksQuery.isError && !changeBlocksMutation.isPending && (blockScope === "BUSINESS" || (!staffListQuery.isLoading && !staffListQuery.isError)));
  const saveBlocks = async (action: "BLOCK" | "UNBLOCK") => {
    if (!businessId || !canChangeBlocks) return;
    try {
      const saved = await changeBlocksMutation.mutateAsync({ businessId, action, intervals: selectedSlots.map(key => JSON.parse(key) as LocalCalendarRange) });
      setSelectedSlots([]);
      toast.success(action === "BLOCK" ? "Calendar blocks saved" : "Calendar slots reopened");
      if (saved.overlappingBookings) toast.warning(`${saved.overlappingBookings} existing appointment(s) overlap this block and remain booked. Review them using the existing booking actions.`);
    } catch (error) { toast.error(toUserMessage(error)); }
  };
  const visibleDateKey = isoDateOnly(currentDate);
  const relevantStaff = (staffListQuery.data?.members ?? []).filter(member => selectedStaffFilter === null || member.membershipId === selectedStaffFilter);
  const relevantMembershipIds = staffColumns.filter(member => selectedStaffFilter === null || member.membershipId === selectedStaffFilter).map(member => member.membershipId);
  const relevantBookings = bookings.filter(booking => selectedStaffFilter === null || booking.staffMembershipIds.some(id => relevantMembershipIds.includes(id)));
  const { startHour: gridStartHour, endHour: gridEndHour } = calendarDayHours(
    visibleDateKey, relevantBookings, calendarQuery.data?.openingHours ?? [], relevantStaff.map(member => member.schedule ?? []), calendarTimezone,
  );
  const timelineTimezone = calendarTimezone ?? relevantBookings[0]?.schedule.timezone ?? "Europe/Nicosia";
  const timeline = calendarDayTimeline(visibleDateKey, timelineTimezone);
  const transitionDay = timeline.endAt - timeline.startAt !== 24 * 3600000;
  const gridSlots = transitionDay ? timeline.slots : timeline.slots.filter(slot => slot.wallMinute >= gridStartHour * 60 && slot.wallMinute < gridEndHour * 60);
  const gridStartMs = gridSlots[0]?.startAt ?? timeline.startAt;
  const gridEndMs = gridSlots.at(-1)?.endAt ?? timeline.endAt;
  const gridHeight = (gridEndMs - gridStartMs) / 60000 * PX_PER_MINUTE;
  const selectedRangeBlocked = (key: string) => {
    if (viewMode !== "Today") return rangeState(key).blocked;
    const range = JSON.parse(key) as LocalCalendarRange;
    const slot = gridSlots.find(item => JSON.stringify(calendarRange(range.staffMembershipId, visibleDateKey, item.wallMinute, item.wallMinute + 30)) === key);
    return slot ? calendarInstantRangeState(slot.startAt, slot.endAt, visibleDateKey, range.staffMembershipId, blocksQuery.data?.blocks ?? [], blocksQuery.data?.closedPeriods ?? []).blocked : rangeState(key).blocked;
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      {/* Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 py-3 sm:py-0 sm:h-16 border-b border-[#C6C6CB] bg-[#FCF8F8] px-6 items-center justify-between shrink-0 select-none">
        {/* Left side: Today & Date picker */}
        <div className="flex flex-wrap items-center justify-center gap-4 relative">
          {/* Today View Toggle Dropdown */}
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isViewDropdownOpen}
              data-calendar-view-toggle=""
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
                      setSelectedSlots([]);
                      setOpenDropdownCardId(null);
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
              aria-label="Previous date"
              className="px-3 h-full border-r border-[#C6C6CB] hover:bg-neutral-50 transition-all text-neutral-600 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button type="button"
              aria-label="Choose date"
              onClick={() => { setDatePickerMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)); setIsDatePickerOpen(!isDatePickerOpen); }}
              className="flex items-center gap-2 px-4 h-full cursor-pointer hover:bg-neutral-50 transition-all select-none"
            >
              <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[#0C0C0C]" />
              <span className="font-poppins text-xs font-semibold text-[#1C1B1C] whitespace-nowrap">{formatDate(currentDate)}</span>
            </button>
            <button
              onClick={handleNextDate}
              aria-label="Next date"
              className="px-3 h-full border-l border-[#C6C6CB] hover:bg-neutral-50 transition-all text-neutral-600 flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <button type="button" aria-label="Go to today" onClick={() => navigateDate(businessToday(calendarTimezone))} className="rounded-md border border-[#C6C6CB] px-3 py-1.5 text-xs hover:bg-neutral-50">Today</button>
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
                <span>{selectedStaffFilter === null ? "All Staff" : staffColumns.find(staff => staff.membershipId === selectedStaffFilter)?.name ?? "Staff"}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5" />
              </button>
              {isStaffDropdownOpen && (
                <div className="absolute right-0 mt-1.5 z-50 w-40 bg-white rounded-lg shadow-xl border border-neutral-200 flex flex-col py-1 text-xs select-none">
                  {[{ name: "All Staff", membershipId: null }, ...staffColumns.filter((s) => s.membershipId)].map((staff) => (
                    <button
                      key={staff.membershipId ?? "all"}
                      aria-pressed={selectedStaffFilter === (staff.membershipId ?? null)}
                      onClick={() => {
                        setSelectedStaffFilter(staff.membershipId ?? null);
                        setSelectedSlots([]);
                        setOpenDropdownCardId(null);
                        setIsStaffDropdownOpen(false);
                      }}
                      className="px-4 py-2 hover:bg-neutral-50 text-left text-[#111111] font-medium cursor-pointer"
                    >
                      {staff.name}
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

      {businessId && !isStaffDashboard && <div className="flex flex-wrap items-center gap-3 px-6 py-2 text-xs border-b border-neutral-200">
        <label>Block scope <select aria-label="Calendar block scope" value={blockScope} disabled={!canChangeBlocks} onChange={event => { setBlockScope(event.target.value as "STAFF" | "BUSINESS"); setSelectedSlots([]); }} className="ml-2 rounded border bg-white px-2 py-1"><option value="STAFF">Selected Staff</option><option value="BUSINESS">Business-wide</option></select></label>
        <span className="text-neutral-500">Select Day time slots or Weekly dates. Reopen Business-wide blocks in Business-wide scope. Closed periods are managed in Business Settings.</span>
        {blocksQuery.isLoading && <span role="status">Loading saved blocks…</span>}
        {blocksQuery.isError && <span role="alert">Could not load saved blocks. <button className="underline" onClick={() => void blocksQuery.refetch()}>Retry</button></span>}
        {changeBlocksMutation.isPending && <span role="status">Saving calendar blocks…</span>}
      </div>}
      {businessId && !isStaffDashboard && staffListQuery.isLoading && <p role="status" className="px-6 py-2 text-xs">Loading staff…</p>}
      {businessId && !isStaffDashboard && staffListQuery.isError && <p role="alert" className="px-6 py-2 text-xs text-red-700">Staff could not be loaded. <button type="button" className="underline" disabled={staffListQuery.isFetching} onClick={() => void staffListQuery.refetch()}>Retry staff</button></p>}
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
                const activeStaffList = staffColumns.filter(staff => selectedStaffFilter === null || staff.membershipId === selectedStaffFilter);
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
            ) : calendarQuery.isError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
                <span className="font-poppins text-sm font-semibold text-[#BA1A1A]">Couldn&apos;t load calendar</span>
                <span className="font-poppins text-xs text-[#ABAAA6]">Please try again in a moment.</span>
                <button type="button" disabled={calendarQuery.isFetching} onClick={() => void calendarQuery.refetch()} className="text-xs underline disabled:opacity-50">{calendarQuery.isFetching ? "Retrying…" : "Retry calendar"}</button>
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
                      const dayBookings = relevantBookings.filter((b) => bookingDayInterval(b, dateKey, calendarTimezone));
                      const isToday = dateKey === isoDateOnly(today);

                      return (
                        <div
                          key={idx}
                          role={cell.inMonth ? "button" : undefined}
                          tabIndex={cell.inMonth ? 0 : undefined}
                          aria-label={cell.inMonth ? `Open ${dateKey}` : undefined}
                          onKeyDown={(event) => {
                            if (cell.inMonth && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault(); navigateDate(cell.date); setViewMode("Today");
                            }
                          }}
                          onClick={() => {
                            if (cell.inMonth) {
                              navigateDate(cell.date);
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
                                <div key={b.id} className="flex flex-col bg-[#BBEBFF] text-[#195156] text-[10px] font-semibold px-1.5 py-0.5 rounded">
                                  <span className="truncate">
                                    {formatBookingTime(b.schedule.startAt, calendarTimezone ?? b.schedule.timezone)} {b.customerName}
                                  </span>
                                  {b.packageSessions.map((session, index) => (
                                    <span
                                      key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
                                      className="truncate text-[9px]"
                                      title={formatPackageSessionLabel(session)}
                                    >
                                      {formatCompactPackageSessionLabel(session)}
                                    </span>
                                  ))}
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
                  .filter(staff => selectedStaffFilter === null || staff.membershipId === selectedStaffFilter)
                  .map((staff) => {
                    const staffBookings = bookingsForStaff(staff.membershipId);
                    return (
                      <div key={staff.membershipId ?? staff.name} className="flex border-b border-[#C6C6CB] min-h-[140px] relative">
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
                            const slotKey = JSON.stringify(calendarRange(blockScope === "BUSINESS" ? undefined : staff.membershipId, dateKey));
                            const isSelected = selectedSlots.includes(slotKey);
                            const state = rangeState(slotKey);
                            const isDisabled = state.blocked || state.closed;
                            const dayBookings = staffBookings.filter((b) => bookingDayInterval(b, dateKey, calendarTimezone));
                            const hasBooking = dayBookings.length > 0;

                            return (
                              <div
                                key={dayIdx}
                                onClick={() => {
                                  if (!canChangeBlocks || state.closed || (blockScope === "STAFF" && state.global)) return;

                                  const isDeselect = selectedSlots.includes(slotKey);
                                  if (isDeselect) {
                                    setSelectedSlots(prev => prev.filter(k => k !== slotKey));
                                    return;
                                  }

                                  if (selectedSlots.length > 0) {
                                    const firstKey = selectedSlots[0];
                                    const firstIsDisabled = rangeState(firstKey).blocked;
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
                                    <span className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">{state.closed ? "Closed" : state.fullyBlocked ? "Disabled" : "Partially blocked"}</span>
                                  </div>
                                )}
                                {dayBookings.map((b) => {
                                  const tone = BOOKING_STATUS_TONE[b.status];
                                  const instanceKey = `${dateKey}:${staff.membershipId ?? "staff"}:${b.id}`;
                                  return (
                                    <div
                                      key={b.id}
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Booking ${b.reference}`}
                                      onKeyDown={(event) => {
                                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                          event.preventDefault(); setOpenDropdownCardId(openDropdownCardId === instanceKey ? null : instanceKey);
                                        }
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownCardId(openDropdownCardId === instanceKey ? null : instanceKey);
                                      }}
                                      className={`bg-[#0CC0DF]/20 border-l-4 border-[#0CC0DF] rounded px-2 py-1.5 text-xs cursor-pointer hover:brightness-95 transition-all relative ${openDropdownCardId === instanceKey ? "z-40" : "z-20"}`}
                                    >
                                      <div className="font-semibold text-[#020305] text-[11px] truncate flex items-center justify-between">
                                        <span>{formatBookingTime(b.schedule.startAt, calendarTimezone ?? b.schedule.timezone)}–{formatBookingTime(b.schedule.endAt, calendarTimezone ?? b.schedule.timezone)} {b.customerName}</span>
                                      </div>
                                      <div className="text-[10px] text-[#45474B] truncate">{b.serviceNames.join(", ")}</div>
                                      {b.packageSessions.map((session, index) => (
                                        <div
                                          key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
                                          className="text-[9px] font-semibold text-[#3760B7] truncate"
                                          title={formatPackageSessionLabel(session)}
                                        >
                                          {formatCompactPackageSessionLabel(session)}
                                        </div>
                                      ))}
                                      <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: undefined }}>
                                        <span className={`px-1 py-0.5 rounded ${tone === "danger" ? "text-[#BA1A1A]" : tone === "success" ? "text-[#2F8068]" : "text-[#45474B]"}`}>
                                          {BOOKING_STATUS_LABELS[b.status]}
                                        </span>
                                      </div>
                                      {renderDropdown(b.id, instanceKey)}
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
              /* Calendar bounds include configured shifts and actual persisted appointments. */
              <div className="flex w-full relative shrink-0" style={{ height: gridHeight }}>
                {openDropdownCardId && (
                  <div
                    className="fixed inset-0 z-30 bg-transparent cursor-default"
                    onClick={() => setOpenDropdownCardId(null)}
                  />
                )}
                {/* Background Horizontal Grid Lines */}
                <div className="absolute left-[65px] right-0 top-0 bottom-0 pointer-events-none flex flex-col z-0">
                  {gridSlots.map(slot => <div key={slot.startAt} className="w-full border-b border-dashed border-[#C6C6CB]/30" style={{ height: (slot.endAt - slot.startAt) / 60000 * PX_PER_MINUTE }} />)}
                </div>

                {/* Time Column (Left Side Axis) */}
                <div className="border-r border-[#C6C6CB] bg-[#FCF8F8] flex flex-col shrink-0 relative z-10" style={{ width: "64px" }}>
                  {gridSlots.map(slot => (
                    <div key={slot.startAt} className="flex justify-center items-start pt-2" style={{ height: (slot.endAt - slot.startAt) / 60000 * PX_PER_MINUTE }}>
                      {slot.wallMinute % 60 === 0 && <span className="font-poppins text-[11px] font-semibold text-[#45474B]" aria-label={`${formatTime12Hour(`${String(Math.floor(slot.wallMinute / 60)).padStart(2, "0")}:00`)} ${slot.offset}`}>
                        {formatTime12Hour(`${String(Math.floor(slot.wallMinute / 60)).padStart(2, "0")}:00`)}{slot.ambiguous && <span className="block text-[9px]">{slot.offset}</span>}
                      </span>}
                    </div>
                  ))}
                </div>

                {(() => {
                  const activeStaffList = staffColumns.filter(staff => selectedStaffFilter === null || staff.membershipId === selectedStaffFilter);
                  const dateKey = isoDateOnly(currentDate);
                  return (
                    <div className="flex-1 grid divide-x divide-[#C6C6CB] relative w-full" style={{ gridTemplateColumns: `repeat(${Math.max(activeStaffList.length, 1)}, minmax(0, 1fr))` }}>
                      {activeStaffList.map((staff) => {
                        const dayBookings = bookingsForStaff(staff.membershipId).filter((b) => bookingDayInterval(b, dateKey, calendarTimezone));
                        const lanes = calendarDayLanes(dayBookings, dateKey, calendarTimezone);
                        return (
                        <div key={staff.membershipId ?? staff.name} className="relative h-full">
                          {/* Render click-capturable empty slots behind the bookings */}
                          <div className="absolute inset-0 z-0 flex flex-col">
                            {gridSlots.map((slot) => {
                                  const targetStaff = blockScope === "BUSINESS" ? undefined : staff.membershipId;
                                  const slotKey = JSON.stringify(calendarRange(targetStaff, dateKey, slot.wallMinute, slot.wallMinute + 30));
                                  const isSelected = selectedSlots.includes(slotKey);
                                  const state = calendarInstantRangeState(slot.startAt, slot.endAt, dateKey, targetStaff, blocksQuery.data?.blocks ?? [], blocksQuery.data?.closedPeriods ?? []);
                                  const isDisabled = state.blocked || state.closed;
                                  return (
                                    <div
                                      key={slot.startAt}
                                      title={slot.ambiguous || slot.discontinuous ? "This time cannot be edited because local clock changes are ambiguous." : undefined}
                                      onClick={() => {
                                        if (!canChangeBlocks || slot.ambiguous || slot.discontinuous || state.closed || (blockScope === "STAFF" && state.global)) return;
                                        const isDeselect = selectedSlots.includes(slotKey);
                                        if (isDeselect) {
                                          setSelectedSlots(prev => prev.filter(k => k !== slotKey));
                                          return;
                                        }

                                        if (selectedSlots.length > 0) {
                                          const firstKey = selectedSlots[0];
                                          const firstIsDisabled = selectedRangeBlocked(firstKey);
                                          if (isDisabled !== firstIsDisabled) {
                                            return;
                                          }
                                        }

                                        setSelectedSlots(prev => [...prev, slotKey]);
                                      }}
                                      style={{ height: (slot.endAt - slot.startAt) / 60000 * PX_PER_MINUTE }}
                                      className={`w-full relative transition-all cursor-pointer flex items-center justify-center ${
                                        isSelected
                                          ? "bg-[#2E9DA7]/15 border border-[#2E9DA7]"
                                          : isDisabled
                                            ? "bg-[#F1F5F9] border-b border-dashed border-[#CBD5E1] text-[#94A3B8]"
                                            : "hover:bg-neutral-50/50"
                                      }`}
                                    >
                                      {(slot.ambiguous || slot.discontinuous) && !isDisabled && <span className="text-[9px] text-neutral-500">Clock change · editing unavailable</span>}
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

                          {dayBookings.map(b => {
                            const interval = bookingDayInterval(b, dateKey, calendarTimezone);
                            if (!interval) return null;
                            const startMin = interval.from;
                            const endMin = interval.to;
                            const gridStartMin = (gridStartMs - timeline.startAt) / 60000;
                            const gridEndMin = (gridEndMs - timeline.startAt) / 60000;
                            if (endMin <= gridStartMin || startMin >= gridEndMin) return null; // outside the visible grid
                            const clippedStart = Math.max(startMin, gridStartMin);
                            const clippedEnd = Math.min(endMin, gridEndMin);
                            const top = (clippedStart - gridStartMin) * PX_PER_MINUTE;
                            const height = (clippedEnd - clippedStart) * PX_PER_MINUTE;
                            const tone = BOOKING_STATUS_TONE[b.status];
                            const cardColors = TONE_CARD_CLASSNAMES[tone];
                            const placement = lanes.get(b.id) ?? { lane: 0, count: 1 };
                            const instanceKey = `${dateKey}:${staff.membershipId ?? "staff"}:${b.id}`;

                            return (
                              <div
                                key={b.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`Booking ${b.reference}`}
                                onKeyDown={(event) => {
                                  if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                    event.preventDefault(); setOpenDropdownCardId(openDropdownCardId === instanceKey ? null : instanceKey);
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownCardId(openDropdownCardId === instanceKey ? null : instanceKey);
                                }}
                                className={`absolute left-[3%] right-[3%] ${cardColors.bg} border-l-4 ${cardColors.border} rounded-md p-2 shadow-sm flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-transform ${openDropdownCardId === instanceKey ? "z-40" : "z-20"}`}
                                style={{ top: `${top}px`, height: `${height}px`, left: `${3 + placement.lane * 94 / placement.count}%`, right: "auto", width: `${94 / placement.count}%` }}
                              >
                                <button className="absolute right-2 top-2 text-neutral-500 hover:text-neutral-900 select-none cursor-pointer">
                                  <svg className="w-1 h-3" fill="currentColor" viewBox="0 0 4 16">
                                    <path d="M2 10a2 2 0 110-4 2 2 0 010 4zm0-6a2 2 0 110-4 2 2 0 010 4zm0 12a2 2 0 110-4 2 2 0 010 4z" />
                                  </svg>
                                </button>
                                <div>
                                  <div className="flex justify-between items-center pr-4">
                                    <span className="text-[9px] font-medium text-[#45474B] leading-none">
                                      {formatBookingTime(b.schedule.startAt, calendarTimezone ?? b.schedule.timezone)}–{formatBookingTime(b.schedule.endAt, calendarTimezone ?? b.schedule.timezone)}
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
                                  {b.packageSessions.map((session, index) => (
                                    <p
                                      key={`${session.packageProgressId}-${session.sessionIndex}-${index}`}
                                      className="text-[9px] font-semibold text-[#3760B7] truncate"
                                      title={formatPackageSessionLabel(session)}
                                    >
                                      {formatCompactPackageSessionLabel(session)}
                                    </p>
                                  ))}
                                </div>
                                <span className="text-[10px] font-medium text-[#45474B]">{formatBookingMoney(b.totalCents)}</span>
                                {renderDropdown(b.id, instanceKey)}
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
                {blockScope === "BUSINESS" ? "Business-wide schedule" : "Selected Staff schedules"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
            {(() => {
              const hasDisabledSelected = selectedSlots.some(selectedRangeBlocked);

              if (hasDisabledSelected) {
                return (
                  <button
                    disabled={!canChangeBlocks}
                    onClick={() => void saveBlocks("UNBLOCK")}
                    className="bg-[#2E9DA7] text-white text-xs sm:text-sm font-medium px-4 sm:px-[36.2px] h-[44px] sm:h-[50px] rounded-lg hover:bg-[#20848f] transition-colors shadow-md flex-1 sm:flex-initial cursor-pointer"
                  >
                    Activate Selected Slots ({selectedSlots.length})
                  </button>
                );
              }

              return (
                <button
                  disabled={!canChangeBlocks}
                  onClick={() => void saveBlocks("BLOCK")}
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
        isPending={waiveFeeMutation.isPending}
        onClose={() => setWaiveBookingId(null)}
        onConfirm={(reason, internalNote) => {
          if (businessId && waiveBookingId && !lifecycleActionInFlight.current) {
            lifecycleActionInFlight.current = true;
            waiveFeeMutation.mutate(
              { businessId, bookingId: waiveBookingId, reason, internalNote },
              {
                onSuccess: () => { setWaiveBookingId(null); toast.success("No-show charge waived."); },
                onError: (error) => { setWaiveBookingId(null); void calendarQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed calendar before retrying.`); },
                onSettled: () => { lifecycleActionInFlight.current = false; },
              },
            );
          }
        }}
      />

      {/* No-show Confirm Modal Overlay */}
      <NoShowModal
        isOpen={!!noShowBookingId}
        isPending={markNoShowMutation.isPending}
        onClose={() => setNoShowBookingId(null)}
        onConfirm={(payload) => {
          if (businessId && noShowBookingId && !lifecycleActionInFlight.current) {
            lifecycleActionInFlight.current = true;
            markNoShowMutation.mutate(
              {
                businessId,
                bookingId: noShowBookingId,
                reason: payload?.reason,
                internalNote: payload?.internalNote,
              },
              {
                onSuccess: () => { setNoShowBookingId(null); toast.success("No-show timer started."); },
                onError: (error) => { setNoShowBookingId(null); void calendarQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed calendar before retrying.`); },
                onSettled: () => { lifecycleActionInFlight.current = false; },
              },
            );
          }
        }}
      />

      {/* Complete Booking Confirm Modal Overlay */}
      {businessId && completeBookingId && <CalendarBookingCompletion
        key={`${businessId}:${completeBookingId}`}
        businessId={businessId}
        bookingId={completeBookingId}
        onClose={() => setCompleteBookingId(null)}
        onViewBooking={onViewBookingClick}
      />}

      {/* Cancel Booking Confirm Modal Overlay */}
      <CancelBookingModal
        isOpen={!!cancelBookingId}
        isPending={cancelByBusinessMutation.isPending}
        onClose={() => setCancelBookingId(null)}
        onConfirm={(reason) => {
          if (businessId && cancelBookingId && !lifecycleActionInFlight.current) {
            lifecycleActionInFlight.current = true;
            cancelByBusinessMutation.mutate(
              { businessId, bookingId: cancelBookingId, reason },
              {
                onSuccess: () => { setCancelBookingId(null); toast.success("Booking cancelled."); },
                onError: (error) => { setCancelBookingId(null); void calendarQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed calendar before retrying.`); },
                onSettled: () => { lifecycleActionInFlight.current = false; },
              },
            );
          }
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
                      const futureDate = businessToday(calendarTimezone);
                      futureDate.setDate(futureDate.getDate() + (idx + 1) * 7);
                      navigateDate(futureDate);
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

              const m1Index = datePickerMonth.getMonth();
              const m1Year = datePickerMonth.getFullYear();
              const secondMonth = new Date(m1Year, m1Index + 1, 1);
              const m2Index = secondMonth.getMonth();
              const m2Year = secondMonth.getFullYear();

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
                        aria-label="Previous picker month"
                        onClick={() => setDatePickerMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
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
                              navigateDate(new Date(m1Year, m1Index, dayNum));
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
                        aria-label="Next picker month"
                        onClick={() => setDatePickerMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
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
                              navigateDate(new Date(m2Year, m2Index, dayNum));
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
                const now = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
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
                                  navigateDate(new Date(year, monthIndex, dayNum));
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
