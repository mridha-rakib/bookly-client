import { apiRequest } from "./client";

/**
 * P4C — transport for the P4B-2C Owner-only ordinary Booking Calendar routes:
 *   GET  /businesses/:businessId/bookings/:bookingId/calendar-sync
 *   POST /businesses/:businessId/bookings/:bookingId/calendar-sync/recovery
 * Mounted on the API's Business Owner router; a Supervisor or Staff session receives 403.
 *
 * `bindUnusedDestination` (binding a never-synced Booking to the Owner's current calendar) is
 * deliberately NOT exposed here: offering it is an open Owner product decision (P4B-2C D2).
 */
export type BookingCalendarSyncStatus = {
  /** LEGACY: the pre-journal best-effort integration owns this Booking; delivery is untracked. */
  ownership: "LEGACY" | "JOURNAL";
  status: "LEGACY_UNTRACKED" | "SYNCED" | "SYNC_PENDING" | "NOT_CONNECTED" | "RECOVERY_REQUIRED" | "RETRYING";
  state?: string;
  reason?: string;
  incident?:
    | "PROVIDER_OUTCOME_UNKNOWN"
    | "REQUEST_STUCK_BEYOND_OBSERVATION_WINDOW"
    | "PROVIDER_RETRYING"
    | "CONNECTION_OR_DESTINATION_MISMATCH"
    | "CALENDAR_NOT_CONNECTED"
    | "BOOKING_AUTHORITY_CHECK_FAILED"
    | "PROVIDER_PERMANENT_FAILURE";
  recoveryRequired: boolean;
  /** The exact provider request a recovery must name when its settlement is attested. */
  unresolvedRequestId?: string;
  desired?: "PRESENT" | "ABSENT";
  latestSequence?: number;
  confirmedSequence?: number;
  destination?: { accountEmail: string; configuredCalendarId: string; generation: string };
  recoveries?: number;
};

export type BookingCalendarRecoveryInput =
  | {
      incidentReference: string;
      assertion: "ALL_ISSUERS_QUIESCED_AND_PROVIDER_SETTLED";
      requestId: string;
      rebindToCurrentConnection?: true;
    }
  | {
      incidentReference: string;
      assertion: "NO_UNRESOLVED_REQUEST";
      rebindToCurrentConnection?: true;
    };

export type BookingCalendarRecoveryResult = {
  sync: BookingCalendarSyncStatus;
  recovery?: {
    binding?: "UNCHANGED" | "SAME_ACCOUNT_REBIND" | "UNUSED_DESTINATION_BIND";
    assertion: string;
    requestId?: string;
    incidentReference: string;
    at: string;
  };
};

export const bookingCalendarSyncApi = {
  getStatus: (businessId: string, bookingId: string) =>
    apiRequest<BookingCalendarSyncStatus>({
      method: "GET",
      url: `/businesses/${businessId}/bookings/${bookingId}/calendar-sync`,
    }),
  recover: (businessId: string, bookingId: string, input: BookingCalendarRecoveryInput) =>
    apiRequest<BookingCalendarRecoveryResult>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/${bookingId}/calendar-sync/recovery`,
      data: input,
    }),
};
