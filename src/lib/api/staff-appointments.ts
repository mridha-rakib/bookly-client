import type { BookingStatus } from "./bookings";
import { apiRequest } from "./client";

/**
 * P4C-1 (Owner decision D-S1) — a STAFF member's own currently assigned appointments, read-only:
 *   GET /businesses/:businessId/staff/me/appointments
 *   GET /businesses/:businessId/staff/me/appointments/:bookingId
 * The server derives the Staff membership from the session; no staff/user/role id is sent.
 * There is deliberately no mutation here.
 */
export type StaffAppointment = {
  id: string;
  reference: string;
  businessId: string;
  status: BookingStatus;
  schedule: { startAt: string; endAt: string; timezone: string };
  fulfilment:
    | { mode: "AT_BUSINESS_LOCATION"; businessLocation?: { city: string; area: string; streetName: string; streetNumber: string } }
    | { mode: "TRAVEL_TO_CUSTOMER" };
  customer: { displayName: string };
  services: Array<{
    serviceName: string;
    durationMin: number;
    occupiedDurationMin?: number;
    addonNames: string[];
    isPackageSession: boolean;
  }>;
  sharedWithOtherProfessionals: boolean;
};

export type StaffAppointmentPage = {
  appointments: StaffAppointment[];
  page: number;
  limit: number;
  hasMore: boolean;
  range: { fromDate: string; toDate: string };
};

/** D-S2: destination exists only on the server-authorized detail response. */
export type StaffAppointmentDetail = StaffAppointment & {
  travelAddress?: {
    city: string; area: string; streetName: string; streetNumber: string;
    floorUnit?: string; aptRoom?: string;
  };
};

export type StaffAppointmentListParams = {
  status?: BookingStatus[];
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export const staffAppointmentsApi = {
  listMine: (businessId: string, params: StaffAppointmentListParams = {}) =>
    apiRequest<StaffAppointmentPage>({
      method: "GET",
      url: `/businesses/${businessId}/staff/me/appointments`,
      params: {
        ...(params.status?.length ? { status: params.status.join(",") } : {}),
        ...(params.fromDate ? { fromDate: params.fromDate } : {}),
        ...(params.toDate ? { toDate: params.toDate } : {}),
        ...(params.page ? { page: String(params.page) } : {}),
        ...(params.limit ? { limit: String(params.limit) } : {}),
      },
    }),
  getMine: (businessId: string, bookingId: string, signal?: AbortSignal) =>
    apiRequest<StaffAppointmentDetail>({
      method: "GET",
      url: `/businesses/${businessId}/staff/me/appointments/${bookingId}`,
      ...(signal ? { signal } : {}),
    }),
};
