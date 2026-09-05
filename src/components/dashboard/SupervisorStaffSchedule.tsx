"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useManagedBusinessContext } from "@/lib/business/hooks";
import { daysOfWeek, type DayOfWeek, type ScheduleDay, type StaffMember } from "@/lib/api/staff";
import { useStaffListQuery, usePutStaffScheduleMutation } from "@/lib/staff/hooks";

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

type DraftDay = { enabled: boolean; startTime: string; endTime: string };
type Draft = Record<DayOfWeek, DraftDay>;

const buildDraft = (schedule: ScheduleDay[]): Draft => {
  const byDay = new Map(schedule.map((day) => [day.dayOfWeek, day]));
  return Object.fromEntries(
    daysOfWeek.map((dayOfWeek) => {
      const existing = byDay.get(dayOfWeek);
      return [
        dayOfWeek,
        existing
          ? { enabled: true, startTime: existing.startTime, endTime: existing.endTime }
          : { enabled: false, startTime: "09:00", endTime: "18:00" },
      ];
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
      .filter((dayOfWeek) => draft[dayOfWeek].enabled)
      .map((dayOfWeek) => ({
        dayOfWeek,
        startTime: draft[dayOfWeek].startTime,
        endTime: draft[dayOfWeek].endTime,
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
                  {daysOfWeek.map((dayOfWeek) => (
                    <div key={dayOfWeek} className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  [dayOfWeek]: {
                                    ...current[dayOfWeek],
                                    enabled: !current[dayOfWeek].enabled,
                                  },
                                }
                              : current,
                          )
                        }
                        className={`w-[22px] h-[22px] rounded-[5px] flex items-center justify-center shrink-0 ${
                          draft[dayOfWeek].enabled
                            ? "bg-[#2E9DA7] text-white"
                            : "bg-white border border-[#D7D7D7]"
                        }`}
                      >
                        {draft[dayOfWeek].enabled && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="font-poppins text-xs w-9 shrink-0 text-[#111111]">
                        {DAY_LABELS[dayOfWeek]}
                      </span>
                      {draft[dayOfWeek].enabled ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={draft[dayOfWeek].startTime}
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      [dayOfWeek]: {
                                        ...current[dayOfWeek],
                                        startTime: event.target.value,
                                      },
                                    }
                                  : current,
                              )
                            }
                            className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs font-poppins focus:outline-none focus:border-black"
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                          <span className="font-poppins text-xs text-[#888888]">to</span>
                          <select
                            value={draft[dayOfWeek].endTime}
                            onChange={(event) =>
                              setDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      [dayOfWeek]: {
                                        ...current[dayOfWeek],
                                        endTime: event.target.value,
                                      },
                                    }
                                  : current,
                              )
                            }
                            className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs font-poppins focus:outline-none focus:border-black"
                          >
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="font-poppins text-xs text-[#ABAAA6]">Off</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {member.schedule.length === 0 ? (
                    <span className="font-poppins text-xs text-[#ABAAA6]">No schedule set</span>
                  ) : (
                    daysOfWeek
                      .map((dayOfWeek) => member.schedule.find((day) => day.dayOfWeek === dayOfWeek))
                      .filter((day): day is ScheduleDay => Boolean(day))
                      .map((day) => (
                        <span
                          key={day.dayOfWeek}
                          className="font-poppins text-xs text-[#111111] bg-[#F5F3EE] rounded-md px-2 py-1"
                        >
                          {DAY_LABELS[day.dayOfWeek]} {day.startTime}–{day.endTime}
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
