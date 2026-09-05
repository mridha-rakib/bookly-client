"use client";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import { toUserMessage } from "@/lib/auth/messages";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { daysOfWeek, type DayOfWeek, type ScheduleDay } from "@/lib/api/staff";
import { useMyAssignedServicesQuery, useMyScheduleQuery } from "@/lib/staff/hooks";

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/**
 * Phase 4A — Staff/Supervisor self-service: read-only own schedule and own assigned services
 * (GET /businesses/:id/staff/me/schedule, GET /businesses/:id/staff/me/services). No write path
 * here — schedule edits stay Owner/Supervisor-only via DashboardStaffList/SupervisorStaffSchedule.
 * Time off is out of scope for this phase (deferred pending an approval-workflow decision).
 */
export default function StaffMySchedule() {
  const businessId = useCurrentUserQuery().data?.business?.id;
  const scheduleQuery = useMyScheduleQuery(businessId);
  const servicesQuery = useMyAssignedServicesQuery(businessId);

  const scheduleByDay = new Map(
    (scheduleQuery.data ?? []).map((day: ScheduleDay) => [day.dayOfWeek, day]),
  );

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] select-none font-poppins relative">
      <DashboardHeader title="Staff" subtitle="Your schedule and assigned services" />
      <div className="flex-1 p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-3 w-full bg-white border border-[#EDEBE6] rounded-xl p-5">
          <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
            My schedule
          </span>
          {scheduleQuery.isLoading ? (
            <span className="font-poppins text-sm text-neutral-400">Loading…</span>
          ) : scheduleQuery.isError ? (
            <span className="font-poppins text-sm text-[#BA1A1A]">
              {toUserMessage(scheduleQuery.error)}
            </span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {daysOfWeek.map((dayOfWeek) => {
                const day = scheduleByDay.get(dayOfWeek);
                return (
                  <div key={dayOfWeek} className="flex items-center justify-between py-1">
                    <span className="font-poppins text-xs text-[#111111]">
                      {DAY_LABELS[dayOfWeek]}
                    </span>
                    <span className="font-poppins text-xs text-[#5F5E5A]">
                      {day ? `${day.startTime}–${day.endTime}` : "Off"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full bg-white border border-[#EDEBE6] rounded-xl p-5">
          <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
            My assigned services
          </span>
          {servicesQuery.isLoading ? (
            <span className="font-poppins text-sm text-neutral-400">Loading…</span>
          ) : servicesQuery.isError ? (
            <span className="font-poppins text-sm text-[#BA1A1A]">
              {toUserMessage(servicesQuery.error)}
            </span>
          ) : (servicesQuery.data ?? []).length === 0 ? (
            <span className="font-poppins text-xs text-[#ABAAA6]">
              No services are assigned to you yet.
            </span>
          ) : (
            <div className="flex flex-col gap-2">
              {servicesQuery.data?.map((service) => (
                <div key={service.id} className="flex items-center justify-between py-1">
                  <span className="font-poppins text-xs text-[#111111]">{service.name}</span>
                  <span className="font-poppins text-xs text-[#5F5E5A]">
                    {service.subcategory ?? service.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
