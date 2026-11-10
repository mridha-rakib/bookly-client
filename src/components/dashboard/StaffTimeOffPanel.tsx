"use client";

import React, { useState } from "react";

import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import type { StaffMember, StaffTimeOffType } from "@/lib/api/staff";
import { useCreateStaffTimeOffMutation, useRemoveStaffTimeOffMutation } from "@/lib/staff/hooks";
import { formatTimeOffRange, timeOffTypeLabels } from "@/lib/staff/format";

interface StaffTimeOffPanelProps {
  businessId: string;
  member: StaffMember;
}

/**
 * P2.2 — dated Staff time off for the Supervisor team screen, over the existing
 * Owner-or-Supervisor API (list via the Staff list DTO, POST and DELETE
 * `/businesses/:businessId/staff/:staffId/time-off`). The API has no edit operation, so none is
 * offered: change dates by removing and adding again. Time off is its own collection: it never
 * sends or alters the weekly schedule or recurring off-days, and it never cancels Bookings.
 */
export default function StaffTimeOffPanel({ businessId, member }: StaffTimeOffPanelProps) {
  const createMutation = useCreateStaffTimeOffMutation();
  const removeMutation = useRemoveStaffTimeOffMutation();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<StaffTimeOffType>("ANNUAL_HOLIDAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const staffId = member.membershipId;
  if (!staffId) return null;
  const entries = [...(member.timeOff ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const busy = createMutation.isPending || removingId !== null;

  const resetForm = () => {
    setAdding(false);
    setType("ANNUAL_HOLIDAY");
    setStartDate("");
    setEndDate("");
    setFormError("");
  };

  const handleAdd = async () => {
    if (!startDate) {
      setFormError("Choose a start date.");
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError("End date must be on or after the start date.");
      return;
    }
    setFormError("");
    try {
      await createMutation.mutateAsync({
        businessId,
        staffId,
        input: { type, startDate, ...(endDate ? { endDate } : {}) },
      });
      toast.success("Time off added");
      resetForm();
    } catch (error) {
      // Keep the entered values so the Supervisor can correct them (e.g. an overlap).
      setFormError(toUserMessage(error));
    }
  };

  const handleRemove = async (timeOffId: string) => {
    setRemovingId(timeOffId);
    try {
      await removeMutation.mutateAsync({ businessId, staffId, timeOffId });
      toast.success("Time off removed");
      setConfirmingId(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section aria-label={`Time off for ${member.name}`} className="flex flex-col gap-2 border-t border-[#EDEBE6] pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-poppins text-xs font-semibold text-[#111111]">Time off</span>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={busy}
            className="font-poppins text-[11px] font-semibold text-[#0F6E56] hover:underline disabled:opacity-50"
          >
            + Add time off
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <span className="font-poppins text-xs text-[#ABAAA6]">No time off recorded</span>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-2 bg-[#F5F3EE] rounded-md px-2 py-1">
              <span className="font-poppins text-xs text-[#111111]">
                {formatTimeOffRange(entry)} · {timeOffTypeLabels[entry.type]}
              </span>
              {confirmingId === entry.id ? (
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-poppins text-[11px] text-[#5F5E5A]">Remove this time off?</span>
                  <button
                    type="button"
                    onClick={() => void handleRemove(entry.id)}
                    disabled={removingId === entry.id}
                    className="font-poppins text-[11px] font-semibold text-[#BA1A1A] hover:underline disabled:opacity-50"
                  >
                    {removingId === entry.id ? "Removing…" : "Confirm remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={removingId === entry.id}
                    className="font-poppins text-[11px] font-semibold text-[#5F5E5A] hover:underline"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(entry.id)}
                  disabled={busy}
                  aria-label={`Remove time off ${formatTimeOffRange(entry)}`}
                  className="ml-auto font-poppins text-[11px] font-semibold text-[#BA1A1A] hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <fieldset disabled={createMutation.isPending} className="flex flex-col gap-2 bg-white border border-[#EDEBE6] rounded-lg p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 font-poppins text-[11px] text-[#5F5E5A]">
              Type
              <select
                value={type}
                onChange={(event) => setType(event.target.value as StaffTimeOffType)}
                className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs focus:outline-none focus:border-black"
              >
                <option value="ANNUAL_HOLIDAY">{timeOffTypeLabels.ANNUAL_HOLIDAY}</option>
                <option value="SICK_LEAVE">{timeOffTypeLabels.SICK_LEAVE}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-poppins text-[11px] text-[#5F5E5A]">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs focus:outline-none focus:border-black"
              />
            </label>
            <label className="flex flex-col gap-1 font-poppins text-[11px] text-[#5F5E5A]">
              End date (optional)
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-9 bg-white border border-[#D5D2C9] rounded-lg px-2 text-xs focus:outline-none focus:border-black"
              />
            </label>
          </div>
          <p className="font-poppins text-[11px] text-[#5F5E5A]">
            Dates are inclusive. Existing bookings in this period are not cancelled; review them in the Calendar.
          </p>
          {formError && (
            <span role="alert" className="font-poppins text-[11px] text-[#BA1A1A]">{formError}</span>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white bg-[#0F6E56] hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Save time off"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-[#5F5E5A] border border-[#D5D2C9] hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
