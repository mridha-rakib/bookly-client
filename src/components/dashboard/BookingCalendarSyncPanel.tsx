"use client";

import { useState } from "react";

import { BooklyApiError } from "@/lib/api/client";
import type { BookingCalendarSyncStatus } from "@/lib/api/booking-calendar-sync";
import { toUserMessage } from "@/lib/auth/messages";
import { useAuthStore } from "@/lib/auth/store";
import { useBookingCalendarRecoveryMutation, useBookingCalendarSyncQuery } from "@/lib/bookings/calendar-sync";

/**
 * P4C — Business Owner view of one Booking's Google Calendar synchronization (P4B-2C API).
 *
 * The Booking itself is authoritative: nothing here describes the Booking as failed. "Synced"
 * is shown only after the server confirmed the event by reading it back; a legacy-owned
 * Booking is shown as untracked, never as synced. Recovery is offered only for the incident
 * kinds the server can act on, always with an incident reference and an explicit Owner
 * attestation, and always for the exact unresolved request the server reported. The server
 * re-verifies the live Owner session and returns 503 until Calendar delivery is activated.
 * Owner-only: the routes sit on the Business Owner router, so nothing renders for other roles.
 */

const STATUS_COPY: Record<BookingCalendarSyncStatus["status"], { label: string; tone: string; detail: string }> = {
  LEGACY_UNTRACKED: {
    label: "Not tracked",
    tone: "bg-[#F5F4EE] text-[#5F5E5A]",
    detail: "This booking uses the standard Google Calendar connection, which updates your calendar on a best-effort basis. Bookly doesn't track delivery for it.",
  },
  SYNCED: {
    label: "Synced",
    tone: "bg-[#E8F5EC] text-[#1E6B3A]",
    detail: "Google Calendar shows this booking's current time.",
  },
  SYNC_PENDING: {
    label: "Sync pending",
    tone: "bg-[#FFF6E5] text-[#8A5A00]",
    detail: "The latest change is waiting to be sent to Google Calendar. The booking itself is already saved.",
  },
  RETRYING: {
    label: "Retrying",
    tone: "bg-[#FFF6E5] text-[#8A5A00]",
    detail: "Google Calendar didn't accept the last update. Bookly will try again automatically.",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    tone: "bg-[#F5F4EE] text-[#5F5E5A]",
    detail: "Google Calendar wasn't connected when this booking was made, so it won't be added automatically. The booking itself is unaffected.",
  },
  RECOVERY_REQUIRED: {
    label: "Needs your attention",
    tone: "bg-[#FDECEC] text-[#BA1A1A]",
    detail: "Bookly stopped updating Google Calendar for this booking to avoid creating a duplicate or changing the wrong event.",
  },
};

const INCIDENT_COPY: Partial<Record<NonNullable<BookingCalendarSyncStatus["incident"]>, string>> = {
  PROVIDER_OUTCOME_UNKNOWN:
    "Google didn't confirm whether the last change was applied. Check this booking's event in Google Calendar before continuing.",
  CONNECTION_OR_DESTINATION_MISMATCH:
    "Your Google Calendar connection changed. Bookly only continues in the same Google account and calendar that holds this booking's event.",
  BOOKING_AUTHORITY_CHECK_FAILED:
    "This booking no longer matches its calendar record. Please contact Bookly support; no action is available here.",
  PROVIDER_PERMANENT_FAILURE:
    "Google rejected the change, or the event in Google Calendar isn't one Bookly created. Fix the event in Google Calendar, then continue.",
};

/** Incidents an Owner decision can move forward. Others are shown without controls. */
const RECOVERABLE = new Set(["PROVIDER_OUTCOME_UNKNOWN", "CONNECTION_OR_DESTINATION_MISMATCH", "PROVIDER_PERMANENT_FAILURE"]);

const recoveryErrorMessage = (error: unknown) => {
  if (error instanceof BooklyApiError) {
    if (error.status === 503) return "Calendar recovery isn't available yet. Your booking is unaffected.";
    if (error.status === 401) return "Please sign in again to confirm this change.";
    if (error.status === 409) return error.message;
  }
  return toUserMessage(error);
};

function RecoveryForm({ sync, mutation }: {
  sync: BookingCalendarSyncStatus;
  mutation: ReturnType<typeof useBookingCalendarRecoveryMutation>;
}) {
  const [incidentReference, setIncidentReference] = useState("");
  const [attested, setAttested] = useState(false);
  const [rebind, setRebind] = useState(false);
  const requestId = sync.unresolvedRequestId;
  const mismatch = sync.incident === "CONNECTION_OR_DESTINATION_MISMATCH";
  const ready = incidentReference.trim().length > 0 && attested && (!mismatch || rebind) && !mutation.isPending;

  const submit = () => {
    if (!ready) return;
    const base = { incidentReference: incidentReference.trim(), ...(rebind ? { rebindToCurrentConnection: true as const } : {}) };
    mutation.mutate(requestId
      ? { ...base, assertion: "ALL_ISSUERS_QUIESCED_AND_PROVIDER_SETTLED", requestId }
      : { ...base, assertion: "NO_UNRESOLVED_REQUEST" });
  };

  return (
    <form
      aria-label="Resume Google Calendar sync"
      className="flex flex-col gap-3 border-t border-neutral-200/60 pt-4"
      onSubmit={(event) => { event.preventDefault(); submit(); }}
    >
      {requestId && (
        <p className="font-poppins text-xs text-[#5F5E5A]">
          Unconfirmed request: <span className="font-mono text-[11px] text-[#0F1E35]">{requestId}</span>
        </p>
      )}
      <label className="flex flex-col gap-1 font-poppins text-xs text-[#5F5E5A]">
        Your reference for this check
        <input
          value={incidentReference}
          maxLength={200}
          onChange={(event) => setIncidentReference(event.target.value)}
          placeholder="e.g. note or ticket number"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-[#0F1E35]"
        />
      </label>
      {mismatch && (
        <label className="flex items-start gap-2 font-poppins text-xs text-[#0F1E35]">
          <input type="checkbox" checked={rebind} onChange={(event) => setRebind(event.target.checked)} />
          <span>
            Continue in my reconnected Google Calendar. This only works if it&apos;s the same Google account and
            calendar{sync.destination ? ` (${sync.destination.accountEmail})` : ""}; a different account is refused.
          </span>
        </label>
      )}
      <label className="flex items-start gap-2 font-poppins text-xs text-[#0F1E35]">
        <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} />
        <span>
          {requestId
            ? "I checked Google Calendar and confirm Bookly's earlier request for this booking has finished and nothing is still being sent."
            : "I checked this booking's event in Google Calendar and want Bookly to continue."}
        </span>
      </label>
      {mutation.isError && (
        <p role="alert" className="font-poppins text-xs text-[#BA1A1A]">{recoveryErrorMessage(mutation.error)}</p>
      )}
      <button
        type="submit"
        disabled={!ready}
        className="self-start rounded-lg bg-[#0F1E35] px-4 py-2 font-poppins text-xs font-medium text-white disabled:opacity-40"
      >
        {mutation.isPending ? "Saving…" : "Resume calendar sync"}
      </button>
    </form>
  );
}

export default function BookingCalendarSyncPanel({ businessId, bookingId }: { businessId: string; bookingId: string }) {
  const isOwner = useAuthStore((state) => state.user?.role === "BUSINESS_OWNER");
  const query = useBookingCalendarSyncQuery(businessId, bookingId, { enabled: isOwner });
  const recovery = useBookingCalendarRecoveryMutation(businessId, bookingId);
  if (!isOwner) return null;

  return (
    <section
      aria-label="Google Calendar sync"
      className="bg-white border border-neutral-200/60 rounded-2xl p-6 flex flex-col gap-3 w-full shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-poppins text-xs font-normal text-[#73726D] tracking-[0.075em] uppercase">
          Google Calendar
        </span>
        {query.data && (
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_COPY[query.data.status].tone}`}>
            {STATUS_COPY[query.data.status].label}
          </span>
        )}
      </div>
      {query.isLoading && <p className="font-poppins text-xs text-neutral-400">Checking calendar sync…</p>}
      {query.isError && (
        <div className="flex items-center gap-3">
          <p className="font-poppins text-xs text-[#BA1A1A]">Couldn&apos;t load calendar sync status.</p>
          <button type="button" onClick={() => void query.refetch()} className="font-poppins text-xs underline">
            Try again
          </button>
        </div>
      )}
      {query.data && (
        <>
          <p className="font-poppins text-sm text-[#0F1E35]">{STATUS_COPY[query.data.status].detail}</p>
          {query.data.destination && query.data.ownership === "JOURNAL" && (
            <p className="font-poppins text-xs text-[#5F5E5A]">Calendar account: {query.data.destination.accountEmail}</p>
          )}
          {query.data.status === "RECOVERY_REQUIRED" && query.data.incident && INCIDENT_COPY[query.data.incident] && (
            <p className="font-poppins text-xs text-[#5F5E5A]">{INCIDENT_COPY[query.data.incident]}</p>
          )}
          {recovery.isSuccess && (
            <p role="status" className="font-poppins text-xs text-[#1E6B3A]">
              Recorded. Bookly will continue syncing this booking to Google Calendar.
            </p>
          )}
          {!recovery.isSuccess && query.data.status === "RECOVERY_REQUIRED" && query.data.incident &&
            RECOVERABLE.has(query.data.incident) && <RecoveryForm sync={query.data} mutation={recovery} />}
        </>
      )}
    </section>
  );
}
