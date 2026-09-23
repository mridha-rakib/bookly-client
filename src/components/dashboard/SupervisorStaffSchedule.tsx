"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useManagedBusinessContext } from "@/lib/business/hooks";
import {
  daysOfWeek,
  type DayOfWeek,
  type ScheduleDay,
  type ScheduleInterval,
  type StaffMember,
} from "@/lib/api/staff";
import { useStaffListQuery, usePutStaffScheduleMutation } from "@/lib/staff/hooks";
import {
  formatIntervalsList,
  buildShiftTimeSelectOptions,
  parseTime12HourInputFromCanonical,
  parseTime12HourToCanonical,
  parseTimeInputText,
} from "@/lib/staff/format";

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

// A day's "enabled" state is derived from intervals.length > 0 — no separate flag, so it can
// never drift out of sync with the actual interval list (rule 6: removing the last interval
// leaves the day as "no hours configured", never implicitly re-derived as something else).
type DraftDay = { intervals: ScheduleInterval[] };
type Draft = Record<DayOfWeek, DraftDay>;

const buildDraft = (schedule: ScheduleDay[]): Draft => {
  const byDay = new Map(schedule.map((day) => [day.dayOfWeek, day]));
  return Object.fromEntries(
    daysOfWeek.map((dayOfWeek) => {
      const existing = byDay.get(dayOfWeek);
      return [dayOfWeek, { intervals: existing ? existing.intervals : [] }];
    }),
  ) as Draft;
};

/**
 * Phase 4A — Supervisor's Staff tab: read the team list and manage schedules (Owner-or-Supervisor
 * per staff.route.ts's new schedule/list gate — see requireOwnedOrSupervisedStaffBusiness).
 * Deliberately excludes every core staff-identity action (add/edit/remove/invite) — those stay
 * BUSINESS_OWNER-only; this screen only ever calls listStaff (read) and putSchedule (write).
 */
export default function SupervisorStaffSchedule() {
  const { businessId, isLoading: businessIsLoading } = useManagedBusinessContext();
  const staffListQuery = useStaffListQuery(businessId);
  const putScheduleMutation = usePutStaffScheduleMutation();
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const members = (staffListQuery.data?.members ?? []).filter((member) => !member.isOwner);

  const startEditing = (member: StaffMember) => {
    if (!member.membershipId) {
      return;
    }
    setEditingStaffId(member.membershipId);
    setDraft(buildDraft(member.schedule));
  };

  const cancelEditing = () => {
    setEditingStaffId(null);
    setDraft(null);
  };

  const saveSchedule = async () => {
    if (!businessId || !editingStaffId || !draft) {
      return;
    }

    const days: ScheduleDay[] = daysOfWeek
      .filter((dayOfWeek) => draft[dayOfWeek].intervals.length > 0)
      .map((dayOfWeek) => ({
        dayOfWeek,
        intervals: draft[dayOfWeek].intervals,
      }));

    try {
      await putScheduleMutation.mutateAsync({ businessId, staffId: editingStaffId, input: { days } });
      toast.success("Schedule updated");
      cancelEditing();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  if (!businessIsLoading && !businessId) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none font-poppins relative">
        <DashboardHeader title="Staff" subtitle="Team members and schedules" />
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center px-6">
          <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">
            Staff isn&apos;t available for your account
          </span>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] select-none font-poppins relative">
      <DashboardHeader title="Staff" subtitle="Team members and schedules" />
      <div className="flex-1 p-6 md:p-8 flex flex-col gap-4">
        {staffListQuery.isLoading ? (
          <span className="font-poppins text-sm text-neutral-400">Loading staff…</span>
        ) : staffListQuery.isError ? (
          <span className="font-poppins text-sm text-[#BA1A1A]">
            {toUserMessage(staffListQuery.error)}
          </span>
        ) : members.length === 0 ? (
          <span className="font-poppins text-sm text-[#5F5E5A]">No team members yet.</span>
        ) : (
          members.map((member) => (
            <div
              key={member.membershipId ?? member.userId}
              className="flex flex-col gap-4 w-full bg-white border border-[#EDEBE6] rounded-xl p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {member.name}
                  </span>
                  <span className="font-poppins text-xs text-[#5F5E5A]">
                    {member.role === "SUPERVISOR" ? "Supervisor" : "Staff"}
                    {!member.employmentActive ? " · Inactive" : ""}
                  </span>
                </div>
                {editingStaffId === member.membershipId ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="h-9 px-4 rounded-lg text-xs font-poppins font-semibold text-[#5F5E5A] border border-[#D5D2C9] hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveSchedule}
                      disabled={putScheduleMutation.isPending}
                      className="h-9 px-4 rounded-lg text-xs font-poppins font-semibold text-white bg-[#0F6E56] hover:opacity-90 disabled:opacity-50"
                    >
                      {putScheduleMutation.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEditing(member)}
                    className="h-9 px-4 rounded-lg text-xs font-poppins font-semibold text-[#111111] border border-[#D5D2C9] hover:bg-neutral-50"
                  >
                    Edit schedule
                  </button>
                )}
              </div>

              {editingStaffId === member.membershipId && draft ? (
                <div className="flex flex-col gap-2.5">
                  {daysOfWeek.map((dayOfWeek) => {
                    const dayIntervals = draft[dayOfWeek].intervals;
                    const updateInterval = (index: number, patch: Partial<ScheduleInterval>) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              [dayOfWeek]: {
                                intervals: current[dayOfWeek].intervals.map((interval, i) =>
                                  i === index ? { ...interval, ...patch } : interval,
                                ),
                              },
                            }
                          : current,
                      );
                    const addInterval = () =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              [dayOfWeek]: {
                                intervals: [
                                  ...current[dayOfWeek].intervals,
                                  { startTime: "09:00", endTime: "18:00" },
                                ],
                              },
                            }
                          : current,
                      );
                    const removeInterval = (index: number) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              [dayOfWeek]: {
                                intervals: current[dayOfWeek].intervals.filter((_, i) => i !== index),
                              },
                            }
                          : current,
                      );

                    return (
                      <div key={dayOfWeek} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => (dayIntervals.length > 0 ? removeInterval(0) : addInterval())}
                            className={`w-[22px] h-[22px] rounded-[5px] flex items-center justify-center shrink-0 ${
                              dayIntervals.length > 0
                                ? "bg-[#2E9DA7] text-white"
                                : "bg-white border border-[#D7D7D7]"
                            }`}
                          >
                            {dayIntervals.length > 0 && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <span className="font-poppins text-xs w-9 shrink-0 text-[#111111]">
                            {DAY_LABELS[dayOfWeek]}
                          </span>
                          {dayIntervals.length === 0 && (
                            <span className="font-poppins text-xs text-[#ABAAA6]">No hours configured</span>
                          )}
                          {dayIntervals.length > 0 && (
                            <button
                              type="button"
                              onClick={addInterval}
                              className="ml-auto font-poppins text-[11px] font-semibold text-[#0F6E56] hover:underline"
                            >
                              + Add interval
                            </button>
                          )}
                        </div>
                        {dayIntervals.map((interval, index) => {
                          // Hydrates the 12-hour select + AM/PM toggle from the interval's own
                          // canonical HH:mm — same helper, same "H:MM" select-value shape as the
                          // Owner's Add/Edit Staff editor (DashboardStaffList), so both editors
                          // hydrate and convert identically.
                          const startInfo = parseTime12HourInputFromCanonical(interval.startTime);
                          const endInfo = parseTime12HourInputFromCanonical(interval.endTime);
                          const startSelectValue = `${startInfo.hour}:${String(startInfo.minute).padStart(2, "0")}`;
                          const endSelectValue = `${endInfo.hour}:${String(endInfo.minute).padStart(2, "0")}`;

                          const setStart = (hour: number, minute: number, period: "AM" | "PM") =>
                            updateInterval(index, { startTime: parseTime12HourToCanonical(hour, minute, period) });
                          const setEnd = (hour: number, minute: number, period: "AM" | "PM") =>
                            updateInterval(index, { endTime: parseTime12HourToCanonical(hour, minute, period) });

                          return (
                            <div key={index} className="flex items-center gap-2 pl-9 flex-wrap">
                              <select
                                aria-label="Start shift time"
                                value={startSelectValue}
                                onChange={(event) => {
                                  const parsed = parseTimeInputText(event.target.value);
                                  if (parsed) setStart(parsed.hour, parsed.minute, startInfo.period);
                                }}
                                className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs font-poppins focus:outline-none focus:border-black cursor-pointer"
                              >
                                {buildShiftTimeSelectOptions(startSelectValue).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex bg-neutral-100 rounded-lg p-0.5 select-none h-7 items-center shrink-0">
                                <button type="button" onClick={() => setStart(startInfo.hour, startInfo.minute, "AM")} className={`px-1.5 h-6 rounded-md text-[10px] font-semibold transition-all ${startInfo.period === "AM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>AM</button>
                                <button type="button" onClick={() => setStart(startInfo.hour, startInfo.minute, "PM")} className={`px-1.5 h-6 rounded-md text-[10px] font-semibold transition-all ${startInfo.period === "PM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>PM</button>
                              </div>
                              <span className="font-poppins text-xs text-[#888888]">to</span>
                              <select
                                aria-label="End shift time"
                                value={endSelectValue}
                                onChange={(event) => {
                                  const parsed = parseTimeInputText(event.target.value);
                                  if (parsed) setEnd(parsed.hour, parsed.minute, endInfo.period);
                                }}
                                className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs font-poppins focus:outline-none focus:border-black cursor-pointer"
                              >
                                {buildShiftTimeSelectOptions(endSelectValue).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex bg-neutral-100 rounded-lg p-0.5 select-none h-7 items-center shrink-0">
                                <button type="button" onClick={() => setEnd(endInfo.hour, endInfo.minute, "AM")} className={`px-1.5 h-6 rounded-md text-[10px] font-semibold transition-all ${endInfo.period === "AM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>AM</button>
                                <button type="button" onClick={() => setEnd(endInfo.hour, endInfo.minute, "PM")} className={`px-1.5 h-6 rounded-md text-[10px] font-semibold transition-all ${endInfo.period === "PM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>PM</button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeInterval(index)}
                                className="font-poppins text-[11px] font-semibold text-[#BA1A1A] hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {member.schedule.filter((day) => day.intervals.length > 0).length === 0 ? (
                    <span className="font-poppins text-xs text-[#ABAAA6]">No schedule set</span>
                  ) : (
                    daysOfWeek
                      .map((dayOfWeek) => member.schedule.find((day) => day.dayOfWeek === dayOfWeek))
                      .filter((day): day is ScheduleDay => day !== undefined && day.intervals.length > 0)
                      .map((day) => (
                        <span
                          key={day.dayOfWeek}
                          className="font-poppins text-xs text-[#111111] bg-[#F5F3EE] rounded-md px-2 py-1"
                        >
                          {DAY_LABELS[day.dayOfWeek]} {formatIntervalsList(day.intervals)}
                        </span>
                      ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
